const crypto = require('crypto');
const admin = require('firebase-admin');

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

function parseSignatureHeader(headerValue) {
  const parsed = {};
  String(headerValue || '')
    .split(',')
    .map((part) => part.trim())
    .forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        parsed[key.trim()] = value.trim();
      }
    });
  return parsed;
}

function signatureLooksValid(rawBody, headerValue, webhookSecret) {
  if (!webhookSecret) {
    return true;
  }

  const parsed = parseSignatureHeader(headerValue);
  const providedCandidates = ['v1', 'te', 'sig']
    .map((key) => parsed[key])
    .filter(Boolean);

  if (!providedCandidates.length) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  return providedCandidates.some((provided) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    } catch (error) {
      return false;
    }
  });
}

function getAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('missing_firebase_service_account');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (error) {
    throw new Error('invalid_firebase_service_account_json');
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  return admin.app();
}

async function processPaidTopupEvent(db, payload, eventData) {
  const eventId = payload?.data?.id || '';
  const attributes = eventData?.attributes || {};
  const metadata =
    attributes?.metadata
    || attributes?.checkout_session?.data?.attributes?.metadata
    || attributes?.checkout_session?.attributes?.metadata
    || {};

  const userId = String(
    metadata?.userId
    || metadata?.user_id
    || attributes?.metadata?.userId
    || ''
  ).trim();

  const creditsToAdd = Number(
    metadata?.credits
    || metadata?.creditAmount
    || metadata?.credit_amount
    || 0
  );

  const checkoutSessionId =
    eventData?.id
    || attributes?.checkout_session?.data?.id
    || attributes?.checkout_session?.id
    || null;

  if (!eventId) {
    throw new Error('missing_event_id');
  }

  if (!userId) {
    throw new Error('missing_user_id');
  }

  if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
    throw new Error('invalid_credits');
  }

  const now = new Date().toISOString();
  const increment = admin.firestore.FieldValue.increment(creditsToAdd);

  const eventRef = db.collection('paymongo_events').doc(eventId);
  const userRef = db.collection('users').doc(userId);
  const playerRef = db.collection('players').doc(userId);

  let duplicate = false;

  await db.runTransaction(async (tx) => {
    const [eventDoc, userDoc, playerDoc] = await Promise.all([
      tx.get(eventRef),
      tx.get(userRef),
      tx.get(playerRef)
    ]);

    if (eventDoc.exists) {
      duplicate = true;
      return;
    }

    const existingUser = userDoc.exists ? userDoc.data() || {} : {};

    tx.set(userRef, {
      id: userId,
      username: existingUser.username || String(metadata?.username || ''),
      gold: increment,
      updatedAt: now,
      lastTopup: {
        creditsAdded: creditsToAdd,
        eventId,
        checkoutSessionId,
        appliedAt: now,
        metadata: {
          offerId: String(metadata?.offerId || metadata?.offer_id || ''),
          amountPhp: String(metadata?.amountPhp || metadata?.amount_php || ''),
          username: String(metadata?.username || '')
        }
      }
    }, { merge: true });

    const playerCurrency = playerDoc.exists
      ? (playerDoc.data()?.currency || {})
      : {};

    tx.set(playerRef, {
      id: userId,
      currency: {
        ...playerCurrency,
        gold: increment
      },
      updatedAt: now
    }, { merge: true });

    tx.set(eventRef, {
      eventId,
      type: payload?.data?.attributes?.type || 'unknown',
      createdAt: now,
      processed: true,
      userId,
      creditsAdded: creditsToAdd,
      checkoutSessionId
    });
  });

  return {
    duplicate,
    userId,
    creditsToAdd,
    checkoutSessionId,
    metadata,
    eventId
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Paymongo-Signature'
      },
      body: ''
    };
  }

  if (event.httpMethod === 'GET') {
    return json(200, {
      ok: true,
      service: 'paymongo-webhook',
      hasWebhookSecret: Boolean(process.env.PAYMONGO_WEBHOOK_SECRET),
      hasFirebaseServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT)
    });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  try {
    const rawBody = event.body || '';
    const signatureHeader = event.headers?.['paymongo-signature'] || event.headers?.['Paymongo-Signature'] || '';

    if (!signatureLooksValid(rawBody, signatureHeader, process.env.PAYMONGO_WEBHOOK_SECRET || '')) {
      console.warn('paymongo-webhook invalid signature');
      return json(401, { error: 'invalid_signature' });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const eventType = payload?.data?.attributes?.type || '';
    const eventData = payload?.data?.attributes?.data || {};

    console.log('paymongo-webhook received event:', {
      eventId: payload?.data?.id || null,
      eventType: eventType || 'unknown'
    });

    if (eventType === 'checkout_session.payment.paid') {
      getAdminApp();
      const db = admin.firestore();

      const result = await processPaidTopupEvent(db, payload, eventData);

      if (result.duplicate) {
        return json(200, { ok: true, receivedType: eventType, duplicate: true });
      }

      console.log('Top-up paid:', {
        username: result.metadata.username,
        userId: result.userId,
        offerId: result.metadata.offerId,
        creditsAdded: result.creditsToAdd,
        amountPhp: result.metadata.amountPhp,
        checkoutSessionId: result.checkoutSessionId,
        eventId: result.eventId
      });
    } else {
      console.log('paymongo-webhook ignored event type:', eventType || 'unknown');
    }

    return json(200, { ok: true, receivedType: eventType || 'unknown' });
  } catch (error) {
    console.error('paymongo-webhook error:', error);
    return json(500, { error: 'webhook_processing_failed' });
  }
};
