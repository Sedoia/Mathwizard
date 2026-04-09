# Secure Deployment Runbook (Netlify + Firebase)

This guide explains exactly how to deploy the project with secure server-side admin operations.

The secure admin endpoint is:
- Path: `/.netlify/functions/admin-api`
- Source file: `netlify/functions/admin-api.js`

The endpoint only executes admin actions after:
1. Verifying a Firebase ID token
2. Confirming the caller has `role: "admin"` in `users/{uid}`

---

## 0) Prerequisites

Before starting, make sure you have:
- A Firebase project with Authentication + Firestore enabled
- A Netlify site connected to this repository
- One verified admin user document in Firestore (`users/{uid}.role = "admin"`)
- Node.js 18+ installed locally

---

## 1) Confirm project files are present

Required files:
- `netlify/functions/admin-api.js`
- `assets/js/adminApi.js`
- `netlify.toml`
- `package.json`

`netlify.toml` must include:

```toml
[functions]
	directory = "netlify/functions"
```

---

## 2) Install dependencies locally

Run from project root:

```bash
npm install
```

This installs `firebase-admin`, which is required by the serverless function.

---

## 3) Create Firebase service account key

In Firebase Console:
1. Open Project Settings
2. Go to Service accounts
3. Click Generate new private key
4. Download the JSON key file

Important:
- Treat this file like a password
- Never commit it to Git
- Never expose it in frontend code

---

## 4) Add Netlify environment variable

In Netlify:
1. Site settings -> Environment variables
2. Add variable:
	 - Key: `FIREBASE_SERVICE_ACCOUNT`
	 - Value: Full JSON content of your service account key

Notes:
- Paste raw JSON as one value
- If `private_key` contains `\\n`, the function already normalizes it

Recommended scope:
- Set for Production and Branch Deploys only
- Avoid exposing in Deploy Previews unless needed

---

## 5) Restrict Firebase auth/domain settings

In Firebase Authentication settings:
1. Add your Netlify domain and custom domain to Authorized domains
2. Remove unused or old domains

This prevents token issuance from unknown hosts.

---

## 6) Deploy Firestore security rules

Ensure `firestore.rules` is deployed, not just edited locally.

If using Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

Why this matters:
- Client code is public
- Firestore rules are your primary data access control

---

## 7) Deploy to Netlify

Trigger a deploy via:
- Git push to connected branch, or
- Netlify manual deploy

After deploy, open:
- Site -> Functions
- Verify `admin-api` appears and is active

---

## 8) Verify secure behavior (required checks)

Run these tests in production:

1. Unauthenticated request
- Call `/.netlify/functions/admin-api` without token
- Expected: `401` with `missing_bearer_token`

2. Authenticated non-admin user
- Call endpoint with valid Firebase token from player account
- Expected: `403` with `forbidden`

3. Authenticated admin user
- Call an allowed action (`listUsers`)
- Expected: `200` and `{ ok: true }`

4. Input validation test
- Send malformed payload for `upsertShopItem`
- Expected: `400` with validation error

---

## 9) Use admin API from frontend (pattern)

Use helper at:
- `assets/js/adminApi.js`

Example:

```javascript
const users = await window.adminApi.listUsers(50);
await window.adminApi.deleteUser("targetUid");
await window.adminApi.upsertShopItem(null, {
	name: "Arcane Tome",
	description: "Boosts focus",
	icon: "fa-book",
	category: "boost",
	rarity: "rare",
	imageUrl: "",
	price: 250,
	stock: 20,
	isActive: true
});
```

Do not perform sensitive admin writes directly from frontend Firestore calls.

---

## 10) Security checklist before go-live

- `FIREBASE_SERVICE_ACCOUNT` set in Netlify
- Firestore rules deployed
- At least one real admin user set in `users/{uid}`
- Admin actions routed through `window.adminApi`
- No hardcoded credentials in source
- Netlify security headers/CSP active
- Firebase App Check enabled (recommended)

---

## 11) Troubleshooting

### Error: `Missing FIREBASE_SERVICE_ACCOUNT environment variable.`
Cause:
- Netlify env var missing or not available to current deploy context

Fix:
- Add `FIREBASE_SERVICE_ACCOUNT` in Netlify settings
- Re-deploy

### Error: `FIREBASE_SERVICE_ACCOUNT must be valid JSON.`
Cause:
- Invalid JSON formatting in env var

Fix:
- Re-copy full JSON from key file
- Ensure no extra quotes or truncated content

### Error: `403 forbidden` for admin user
Cause:
- `users/{uid}.role` is not `admin`

Fix:
- Update role in Firestore for correct uid

### Function not found at `/.netlify/functions/admin-api`
Cause:
- Wrong functions directory or deploy issue

Fix:
- Confirm `netlify.toml` has `[functions] directory = "netlify/functions"`
- Confirm file exists at `netlify/functions/admin-api.js`
- Re-deploy

---

## 12) Next hardening step (recommended)

Migrate all existing `admin.html` sensitive operations to `window.adminApi` so:
- Browser cannot directly perform privileged Firestore writes
- Admin authorization is consistently enforced on server side

