const crypto = require('crypto');
const {
  admin,
  authenticate,
  hashOtp,
  isNcstEmail,
  json,
  options,
  sendEmail
} = require('./otp-common');

const CODE_TTL_SECONDS = 300;

function getResendCooldownSeconds() {
  const configured = Number.parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);
  return Number.isFinite(configured) && configured >= 0 ? configured : 60;
}

/**
 * POST /.netlify/functions/request-otp with a Firebase ID token.
 * The recipient address is read from Firebase Auth and the OTP is stored server-side.
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return options();
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  try {
    const { user, db } = await authenticate(event);
    const email = String(user.email || '').trim().toLowerCase();
    if (!isNcstEmail(email)) {
      return json(403, { error: 'ncst_email_required' });
    }

    const uid = user.uid;
    const code = String(crypto.randomInt(100000, 1000000));
    const requestId = crypto.randomUUID();
    const now = Date.now();
    const cooldownSeconds = getResendCooldownSeconds();
    const ref = db.collection('otp_verifications').doc(`unity_${uid}`);

    const reservation = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const previous = snapshot.exists ? snapshot.data() : {};
      const lastSentAt = previous.lastSentAt?.toMillis?.() || 0;
      const waitSeconds = Math.ceil((lastSentAt + cooldownSeconds * 1000 - now) / 1000);

      if (lastSentAt && waitSeconds > 0) {
        return { error: 'wait_before_resend', retryAfterSeconds: waitSeconds };
      }

      transaction.set(ref, {
        requestId,
        codeHash: hashOtp(uid, code),
        createdAt: admin.firestore.Timestamp.fromMillis(now),
        expiresAt: admin.firestore.Timestamp.fromMillis(now + CODE_TTL_SECONDS * 1000),
        lastSentAt: admin.firestore.Timestamp.fromMillis(now),
        attempts: 0
      });
      return { reserved: true };
    });

    if (reservation.error) {
      return json(429, reservation);
    }

    try {
      await sendEmail(
        email,
        'MathWizard - NCST Verification Code',
        `<p>Your MathWizard verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in 5 minutes.</p>`
      );
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot.exists && snapshot.data()?.requestId === requestId) {
          transaction.delete(ref);
        }
      });
      console.error('request-otp email delivery failed:', error.message);
      return json(502, { error: 'email_delivery_failed' });
    }

    return json(200, {
      success: true,
      expiresAt: now + CODE_TTL_SECONDS * 1000
    });
  } catch (error) {
    if (error.statusCode) {
      return json(error.statusCode, { error: 'unauthorized' });
    }
    console.error('request-otp failed:', error);
    return json(500, {
      error: error.message === 'missing_otp_secret'
        ? 'server_configuration_error'
        : 'internal_error'
    });
  }
};
