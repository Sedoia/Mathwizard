/*
 * Secure admin API client for Netlify Function endpoint.
 * All sensitive operations should call this endpoint instead of direct client writes.
 */

async function callAdminApi(action, payload = {}) {
  if (!window.firebaseAuth?.currentUser) {
    throw new Error('Not authenticated.');
  }

  const token = await window.firebaseAuth.currentUser.getIdToken(true);
  const response = await fetch('/.netlify/functions/admin-api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ action, ...payload })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Admin API request failed.');
  }

  return data.result;
}

window.adminApi = {
  listUsers(limit = 50) {
    return callAdminApi('listUsers', { limit });
  },
  deleteUser(targetUid) {
    return callAdminApi('deleteUser', { targetUid });
  },
  upsertShopItem(itemId, item) {
    return callAdminApi('upsertShopItem', { itemId, item });
  },
  deleteShopItem(itemId) {
    return callAdminApi('deleteShopItem', { itemId });
  }
};
