const PAYMONGO_API_BASE = 'https://api.paymongo.com/v1';

const OFFER_CATALOG = Object.freeze({
  credits_100: { id: 'credits_100', credits: 100, amountPhp: 50 },
  credits_250: { id: 'credits_250', credits: 250, amountPhp: 110 },
  credits_500: { id: 'credits_500', credits: 500, amountPhp: 200 },
  credits_1200: { id: 'credits_1200', credits: 1200, amountPhp: 450 }
});

const ALLOWED_PAYMENT_METHODS = new Set(['gcash', 'paymaya']);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
}

function sanitizeText(value, maxLength) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function sanitizeUsername(value) {
  const cleaned = sanitizeText(value, 32);
  return /^[A-Za-z0-9_.\- ]{3,32}$/.test(cleaned) ? cleaned : '';
}

function sanitizeUserId(value) {
  const cleaned = sanitizeText(value, 40);
  return /^[A-Za-z0-9_\-]{3,40}$/.test(cleaned) ? cleaned : '';
}

function getBaseUrl() {
  const candidate = process.env.SITE_BASE_URL || process.env.URL || 'http://localhost:8888';
  return candidate.replace(/\/$/, '');
}

function serializeOffers() {
  return Object.values(OFFER_CATALOG).map((offer) => ({
    id: offer.id,
    credits: offer.credits,
    amountPhp: offer.amountPhp
  }));
}

function getAuthHeader(secretKey) {
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

async function createCheckoutSession(payload, secretKey) {
  const response = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(secretKey),
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const rawText = await response.text();
  let data;

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    data = { raw: rawText };
  }

  if (!response.ok) {
    const detail = data?.errors?.[0]?.detail || data?.raw || 'PayMongo request failed';
    throw new Error(detail);
  }

  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod === 'GET') {
    return json(200, {
      ok: true,
      offers: serializeOffers(),
      paymentMethods: ['gcash', 'paymaya']
    });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return json(500, { error: 'missing_paymongo_secret_key' });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const username = sanitizeUsername(body.username);
    const userId = sanitizeUserId(body.userId);
    const offerId = sanitizeText(body.offerId, 50);
    const paymentMethod = sanitizeText(body.paymentMethod, 20).toLowerCase();

    if (!username || !userId) {
      return json(400, { error: 'username_and_userid_required' });
    }

    const offer = OFFER_CATALOG[offerId];
    if (!offer) {
      return json(400, { error: 'invalid_offer' });
    }

    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      return json(400, { error: 'invalid_payment_method' });
    }

    const baseUrl = getBaseUrl();
    const amountCentavos = Math.round(offer.amountPhp * 100);

    const checkoutRequest = {
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              currency: 'PHP',
              amount: amountCentavos,
              description: `${offer.credits} Math Wizard credits`,
              name: `${offer.credits} Credits`,
              quantity: 1
            }
          ],
          payment_method_types: [paymentMethod],
          description: `Top-Up: ${offer.credits} credits`,
          success_url: `${baseUrl}/pages/top-up.html?status=success`,
          cancel_url: `${baseUrl}/pages/top-up.html?status=cancelled`,
          metadata: {
            username,
            userId,
            offerId: offer.id,
            credits: String(offer.credits),
            amountPhp: String(offer.amountPhp)
          }
        }
      }
    };

    const paymongoData = await createCheckoutSession(checkoutRequest, secretKey);
    const attributes = paymongoData?.data?.attributes || {};

    return json(200, {
      ok: true,
      checkoutUrl: attributes.checkout_url,
      checkoutSessionId: paymongoData?.data?.id,
      offer: {
        id: offer.id,
        credits: offer.credits,
        amountPhp: offer.amountPhp
      }
    });
  } catch (error) {
    console.error('paymongo-topup error:', error);
    return json(500, {
      error: 'checkout_creation_failed',
      message: String(error?.message || 'Unknown error')
    });
  }
};
