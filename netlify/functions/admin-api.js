const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT environment variable.');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must be valid JSON.');
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  return admin.app();
}

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

function getBearerToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return '';
  }
  return auth.slice(7).trim();
}

function sanitizeString(value, maxLen = 120) {
  return String(value || '').trim().slice(0, maxLen);
}

function sanitizeShopItem(input) {
  return {
    name: sanitizeString(input?.name, 80),
    description: sanitizeString(input?.description, 300),
    icon: sanitizeString(input?.icon, 40),
    category: sanitizeString(input?.category, 40),
    rarity: sanitizeString(input?.rarity, 20),
    imageUrl: sanitizeString(input?.imageUrl, 500),
    price: Number(input?.price || 0),
    stock: Number(input?.stock || 0),
    isActive: Boolean(input?.isActive)
  };
}

async function assertAdmin(db, uid) {
  const userDoc = await db.collection('users').doc(uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : null;
  if (role !== 'admin') {
    throw new Error('forbidden');
  }
}

async function listUsers(db, body) {
  const limit = Math.min(Math.max(Number(body?.limit || 50), 1), 200);
  const snapshot = await db.collection('users').limit(limit).get();

  const users = snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      name: data.name || '',
      email: data.email || '',
      role: data.role || 'player',
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    };
  });

  return { users, count: users.length };
}

async function deleteUser(db, auth, body, requesterUid) {
  const targetUid = sanitizeString(body?.targetUid, 128);
  if (!targetUid) {
    throw new Error('invalid_target_uid');
  }

  if (targetUid === requesterUid) {
    throw new Error('cannot_delete_self');
  }

  const targetUserDoc = await db.collection('users').doc(targetUid).get();
  if (targetUserDoc.exists && targetUserDoc.data()?.role === 'admin') {
    throw new Error('cannot_delete_admin');
  }

  await db.collection('users').doc(targetUid).delete();
  await db.collection('players').doc(targetUid).delete();

  try {
    await auth.deleteUser(targetUid);
  } catch (error) {
    // If auth user was already removed, we still keep data deletion successful.
    if (!String(error?.code || '').includes('user-not-found')) {
      throw error;
    }
  }

  return { deleted: true, targetUid };
}

async function upsertShopItem(db, body) {
  const item = sanitizeShopItem(body?.item || {});
  if (!item.name) {
    throw new Error('invalid_item_name');
  }

  if (!Number.isFinite(item.price) || item.price < 0) {
    throw new Error('invalid_item_price');
  }

  if (!Number.isFinite(item.stock) || item.stock < 0) {
    throw new Error('invalid_item_stock');
  }

  const now = new Date().toISOString();
  const itemId = sanitizeString(body?.itemId, 128) || db.collection('shop_items').doc().id;
  const ref = db.collection('shop_items').doc(itemId);
  const existing = await ref.get();

  const payload = {
    ...item,
    updatedAt: now,
    createdAt: existing.exists ? existing.data()?.createdAt || now : now
  };

  await ref.set(payload, { merge: true });
  return { itemId, saved: true };
}

async function deleteShopItem(db, body) {
  const itemId = sanitizeString(body?.itemId, 128);
  if (!itemId) {
    throw new Error('invalid_item_id');
  }

  await db.collection('shop_items').doc(itemId).delete();
  return { deleted: true, itemId };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  try {
    getAdminApp();
    const auth = admin.auth();
    const db = admin.firestore();

    const token = getBearerToken(event);
    if (!token) {
      return json(401, { error: 'missing_bearer_token' });
    }

    const decoded = await auth.verifyIdToken(token, true);
    await assertAdmin(db, decoded.uid);

    const body = event.body ? JSON.parse(event.body) : {};
    const action = sanitizeString(body?.action, 80);

    let result;
    switch (action) {
      case 'listUsers':
        result = await listUsers(db, body);
        break;
      case 'deleteUser':
        result = await deleteUser(db, auth, body, decoded.uid);
        break;
      case 'upsertShopItem':
        result = await upsertShopItem(db, body);
        break;
      case 'deleteShopItem':
        result = await deleteShopItem(db, body);
        break;
      default:
        return json(400, { error: 'unknown_action' });
    }

    return json(200, { ok: true, action, result });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (message === 'forbidden') {
      return json(403, { error: 'forbidden' });
    }
    if (message.includes('invalid') || message.includes('cannot_')) {
      return json(400, { error: String(error.message) });
    }

    console.error('admin-api error:', error);
    return json(500, { error: 'internal_error' });
  }
};
