# Math Wizard Top-Up Setup Guide (PayMongo)

This guide is written as a complete step-by-step walkthrough so you can set up, run, test, and deploy the Top-Up feature without guessing.

The Top-Up flow uses PayMongo Checkout Sessions and supports:
- GCash
- PayMaya

## 1. What This Feature Includes

These files are already part of the project:

- Frontend page: `pages/top-up.html`
- Frontend script: `assets/js/topup.js`
- Checkout function: `netlify/functions/paymongo-topup.js`
- Webhook function: `netlify/functions/paymongo-webhook.js`
- Top-Up nav links added in: `profile.html`
- Currency icon asset: `assets/img/currency-icon.png`

## 2. Prerequisites

Before starting, make sure you have:

1. Node.js 18+ installed.
2. npm installed.
3. A PayMongo account.
4. A Netlify account.
5. This project cloned locally.

Optional but recommended:

1. Netlify CLI installed globally:

```bash
npm install -g netlify-cli
```

## 3. Open The Project

1. Open terminal.
2. Go to the project folder:

```bash
cd "C:\Users\Sedo\Desktop\VS Code\MathWizardProject"
```

3. Install dependencies:

```bash
npm install
```

## 4. Get Your PayMongo Keys

1. Log in to PayMongo dashboard.
2. Open `Developers` then `API Keys`.
3. Copy these values:
   - Public key (`pk_...`)
   - Secret key (`sk_...`)

Important:

- Do not put `sk_...` in frontend code.
- Only backend functions should use `PAYMONGO_SECRET_KEY`.

## 5. Configure Environment Variables

You need these environment variables:

- `PAYMONGO_SECRET_KEY`
- `SITE_BASE_URL`
- `PAYMONGO_WEBHOOK_SECRET`

### 5.1 Local Development (.env)

1. Create a `.env` file in the project root (if it does not exist).
2. Add this template:

```env
PAYMONGO_SECRET_KEY=sk_test_xxx
SITE_BASE_URL=http://localhost:8888
PAYMONGO_WEBHOOK_SECRET=whsec_xxx
```

Notes:

- `PAYMONGO_WEBHOOK_SECRET` can be added after you create a webhook in Step 8.
- Keep `.env` local only.

### 5.2 Netlify Production Variables

1. Open your site in Netlify.
2. Go to `Site configuration` -> `Environment variables`.
3. Add the same 3 variables:
   - `PAYMONGO_SECRET_KEY`
   - `SITE_BASE_URL` (example: `https://your-site.netlify.app`)
   - `PAYMONGO_WEBHOOK_SECRET`

## 6. Run The App Locally

1. Start Netlify local dev server:

```bash
npx netlify dev
```

2. Open the Top-Up page:

`http://localhost:8888/pages/top-up.html`

3. Confirm the page loads and offer cards are visible.

## 7. How Checkout Works

When user clicks checkout:

1. Frontend sends this payload to `/.netlify/functions/paymongo-topup`:
   - `username`
   - `userId`
   - `offerId`
   - `paymentMethod`
2. Backend validates all fields.
3. Backend resolves final amount from server-side offer catalog.
4. Backend creates PayMongo Checkout Session.
5. User is redirected to PayMongo hosted checkout page.
6. After payment:
   - success redirect: `.../pages/top-up.html?status=success`
   - cancel redirect: `.../pages/top-up.html?status=cancelled`

## 8. Set Up PayMongo Webhook

This is required to confirm completed payments on your backend.

1. Deploy your site first (or use your existing domain).
2. Build webhook URL:

`https://YOUR-DOMAIN/.netlify/functions/paymongo-webhook`

3. In PayMongo dashboard:
   - Open `Developers` -> `Webhooks`
   - Create a new webhook endpoint using the URL above
   - Subscribe to payment success events (especially `checkout_session.payment.paid`)
4. Copy webhook signing secret from PayMongo.
5. Save it as `PAYMONGO_WEBHOOK_SECRET` in Netlify env variables.
6. Redeploy site (or restart local Netlify dev if testing locally).

## 9. Validate The Feature End-To-End

Follow this exact sequence:

1. Open Top-Up page.
2. Leave Username and User ID empty, then click `Confirm Identity`.
   - Expect validation error.
3. Enter valid Username and User ID, then click `Confirm Identity`.
   - Expect success message.
4. Select an offer.
5. Switch payment method between GCash and PayMaya.
6. Click `Proceed To Checkout`.
7. Confirm redirect to PayMongo checkout URL.
8. Complete payment in test mode.
9. Confirm redirect back to Top-Up page with success state.
10. Check function logs for webhook event processing.

## 10. Anti-Tampering Protections (Already Implemented)

Server-side controls in `netlify/functions/paymongo-topup.js`:

1. Offer catalog is fixed on backend (`OFFER_CATALOG`).
2. Price is derived from backend offer ID only.
3. Allowed methods are restricted to `gcash` and `paymaya`.
4. Username/User ID are sanitized and validated.

Result:

- Client-side edited prices are ignored.

## 11. Current Webhook Behavior

Current behavior in `netlify/functions/paymongo-webhook.js`:

1. Validates signature (if webhook secret exists).
2. Handles `checkout_session.payment.paid`.
3. Logs payment metadata (`username`, `userId`, `offerId`, `amountPhp`).

Current limitation:

- It logs payment only.
- It does not yet write credits to database.

## 12. Next Production Step (Important)

Inside `netlify/functions/paymongo-webhook.js`, replace logging with real crediting logic:

1. Find user by `userId`.
2. Verify event has not been processed before (idempotency).
3. Add credits.
4. Store transaction history.
5. Mark webhook event as processed.

## 13. Quick Troubleshooting

### Offers do not load

Check:

1. `netlify dev` is running.
2. URL is exactly `http://localhost:8888/pages/top-up.html`.
3. Function path exists: `netlify/functions/paymongo-topup.js`.

### Checkout creation fails

Check:

1. `PAYMONGO_SECRET_KEY` is set and starts with `sk_`.
2. Secret key is valid for the PayMongo environment you are testing.
3. Request fields are valid (`username`, `userId`, `offerId`, `paymentMethod`).

### Webhook returns invalid signature

Check:

1. `PAYMONGO_WEBHOOK_SECRET` exactly matches PayMongo value.
2. Webhook URL points to the same deployed environment.
3. App was redeployed after env variable updates.

## 14. Security Checklist

1. Never commit secret keys.
2. Keep service account credentials out of Git.
3. Keep `.env` local only.
4. Use idempotency in webhook processing.
5. Validate user existence before crediting.
6. Log transaction IDs and reject duplicates.

## 15. Final Smoke Test Checklist

Use this before releasing:

1. Top-Up page loads on desktop and mobile.
2. Identity validation blocks empty or invalid inputs.
3. Offer selection updates summary correctly.
4. Checkout button stays disabled until valid state.
5. GCash checkout session can be created.
6. PayMaya checkout session can be created.
7. Success and cancelled redirects render correct messages.
8. Webhook endpoint receives and verifies paid event.
9. No secret keys appear in frontend source.
