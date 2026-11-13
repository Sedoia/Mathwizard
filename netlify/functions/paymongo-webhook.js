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
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (key && value) {
        parsed[key] = value;
      }
    });
  return parsed;
}

function normalizeSignatureValue(input) {
  return String(input || '')
    .trim()
    .replace(/^sha256=/i, '')
    .replace(/^"|"$/g, '');
}

function secureStringEquals(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));

  if (!a.length || !b.length || a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function buildExpectedSignatures(rawBody, webhookSecret, timestamp) {
  const bodyHex = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const bodyBase64 = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('base64');

  const expected = [bodyHex, bodyBase64];

  if (timestamp) {
    const timestampPayload = `${timestamp}.${rawBody}`;
    const tsHex = crypto
      .createHmac('sha256', webhookSecret)
      .update(timestampPayload)
      .digest('hex');

    const tsBase64 = crypto
      .createHmac('sha256', webhookSecret)
      .update(timestampPayload)
      .digest('base64');

    expected.push(tsHex, tsBase64);
  }

  return expected;
}

function signatureLooksValid(rawBody, headerValue, webhookSecret) {
  if (!webhookSecret) {
    return false;
  }

  const parsed = parseSignatureHeader(headerValue);
  const providedCandidates = ['v1', 'te', 'sig', 'signature']
    .map((key) => parsed[key])
    .map(normalizeSignatureValue)
    .filter(Boolean);

  if (!providedCandidates.length) {
    return false;
  }

  const timestamp = parsed.t || parsed.ts || parsed.timestamp || '';
  const expectedSignatures = buildExpectedSignatures(rawBody, webhookSecret, timestamp);

  return providedCandidates.some((provided) => {
    return expectedSignatures.some((expected) => secureStringEquals(provided, expected));
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

function normalizeIncomingWebhookPayload(payload) {
  const wrappedType = payload?.data?.attributes?.type || '';
  const wrappedResource = payload?.data?.attributes?.data || null;
  const wrappedEventId = payload?.data?.id || '';

  if (wrappedType && wrappedResource) {
    return {
      eventType: wrappedType,
      eventId: wrappedEventId,
      resource: wrappedResource
    };
  }

  const directCheckout = payload?.type === 'checkout_session' && payload?.attributes;
  if (directCheckout) {
    const paidByTimestamp = Number(payload?.attributes?.paid_at || 0) > 0;
    const paidByPayments = Array.isArray(payload?.attributes?.payments)
      && payload.attributes.payments.some((p) => p?.attributes?.status === 'paid');

    return {
      eventType: paidByTimestamp || paidByPayments ? 'checkout_session.payment.paid' : 'checkout_session.unknown',
      eventId: String(payload?.id || ''),
      resource: payload
    };
  }

  return {
    eventType: '',
    eventId: String(payload?.data?.id || payload?.id || ''),
    resource: payload || {}
  };
}

async function processPaidTopupEvent(db, payload, eventData) {
  const eventId = String(payload?.data?.id || payload?.id || eventData?.id || '');
  const attributes = eventData?.attributes || {};
  const firstPayment = Array.isArray(attributes?.payments) ? attributes.payments[0] : null;
  const metadata =
    attributes?.metadata
    || firstPayment?.attributes?.metadata
    || attributes?.payment_intent?.attributes?.metadata
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

  const now = new Date().toISOString();

  const eventRef = db.collection('paymongo_events').doc(eventId);
  const pendingRef = checkoutSessionId
    ? db.collection('paymongo_pending_topups').doc(checkoutSessionId)
    : null;

  let duplicate = false;
  let resolvedUserId = userId;
  let resolvedCreditsToAdd = creditsToAdd;
  let resolvedMetadata = { ...metadata };

  await db.runTransaction(async (tx) => {
    const docs = await Promise.all([
      tx.get(eventRef),
      pendingRef ? tx.get(pendingRef) : Promise.resolve(null)
    ]);

    const eventDoc = docs[0];
    const pendingDoc = docs[1];

    if (eventDoc.exists) {
      duplicate = true;
      return;
    }

    const pendingData = pendingDoc?.exists ? (pendingDoc.data() || {}) : {};

    if (!resolvedUserId) {
      resolvedUserId = String(pendingData.userId || '').trim();
    }

    if (!Number.isFinite(resolvedCreditsToAdd) || resolvedCreditsToAdd <= 0) {
      const fallbackCredits = Number(pendingData.credits || 0);
      if (Number.isFinite(fallbackCredits) && fallbackCredits > 0) {
        resolvedCreditsToAdd = fallbackCredits;
      }
    }

    resolvedMetadata = {
      ...pendingData,
      ...resolvedMetadata
    };

    if (!resolvedUserId) {
      throw new Error('missing_user_id');
    }

    if (!Number.isFinite(resolvedCreditsToAdd) || resolvedCreditsToAdd <= 0) {
      throw new Error('invalid_credits');
    }

    const userRef = db.collection('users').doc(resolvedUserId);
    const playerRef = db.collection('players').doc(resolvedUserId);

    const [userDoc, playerDoc] = await Promise.all([
      tx.get(userRef),
      tx.get(playerRef)
    ]);

    const existingUser = userDoc.exists ? userDoc.data() || {} : {};
    const transactionRecord = {
      id: `txn_${eventId}`,
      transactionId: eventId,
      itemName: `${resolvedCreditsToAdd} Aether`,
      name: `${resolvedCreditsToAdd} Aether`,
      category: 'Aether',
      currency: 'Aether',
      aether: resolvedCreditsToAdd,
      credits: resolvedCreditsToAdd,
      amount: Number(resolvedMetadata?.amountPhp || 0),
      date: now,
      status: 'completed',
      checkoutSessionId,
      paymentMethod: String(resolvedMetadata?.paymentMethod || ''),
      offerId: String(resolvedMetadata?.offerId || resolvedMetadata?.offer_id || '')
    };

    tx.set(userRef, {
      id: resolvedUserId,
      username: existingUser.username || String(resolvedMetadata?.username || ''),
      gold: admin.firestore.FieldValue.increment(resolvedCreditsToAdd),
      aether: admin.firestore.FieldValue.increment(resolvedCreditsToAdd),
      purchaseHistory: admin.firestore.FieldValue.arrayUnion(transactionRecord),
      updatedAt: now,
      lastTopup: {
        creditsAdded: resolvedCreditsToAdd,
        eventId,
        checkoutSessionId,
        appliedAt: now,
        metadata: {
          offerId: String(resolvedMetadata?.offerId || resolvedMetadata?.offer_id || ''),
          amountPhp: String(resolvedMetadata?.amountPhp || resolvedMetadata?.amount_php || ''),
          username: String(resolvedMetadata?.username || '')
        }
      }
    }, { merge: true });

    const playerCurrency = playerDoc.exists
      ? (playerDoc.data()?.currency || {})
      : {};

    tx.set(playerRef, {
      id: resolvedUserId,
      currency: {
        ...playerCurrency,
        gold: admin.firestore.FieldValue.increment(resolvedCreditsToAdd),
        aether: admin.firestore.FieldValue.increment(resolvedCreditsToAdd)
      },
      purchaseHistory: admin.firestore.FieldValue.arrayUnion(transactionRecord),
      updatedAt: now
    }, { merge: true });

    tx.set(eventRef, {
      eventId,
      type: payload?.data?.attributes?.type || 'unknown',
      createdAt: now,
      processed: true,
      userId: resolvedUserId,
      creditsAdded: resolvedCreditsToAdd,
      checkoutSessionId
    });

    if (pendingRef && pendingDoc?.exists) {
      tx.set(pendingRef, {
        status: 'applied',
        appliedAt: now,
        eventId,
        updatedAt: now
      }, { merge: true });
    }
  });

  return {
    duplicate,
    userId: resolvedUserId,
    creditsToAdd: resolvedCreditsToAdd,
    checkoutSessionId,
    metadata: resolvedMetadata,
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
      const parsed = parseSignatureHeader(signatureHeader);
      console.warn('paymongo-webhook invalid signature', {
        hasSignatureHeader: Boolean(signatureHeader),
        signatureKeys: Object.keys(parsed),
        bodyLength: rawBody.length
      });
      return json(401, { error: 'invalid_signature' });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const normalized = normalizeIncomingWebhookPayload(payload);
    const eventType = normalized.eventType;
    const eventData = normalized.resource;

    console.log('paymongo-webhook received event:', {
      eventId: normalized.eventId || null,
      eventType: eventType || 'unknown'
    });

    if (eventType === 'checkout_session.payment.paid') {
      getAdminApp();
      const db = admin.firestore();

      const result = await processPaidTopupEvent(db, {
        ...payload,
        id: normalized.eventId || payload?.id
      }, eventData);

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
