const admin = require('firebase-admin');
const crypto = require('crypto');

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
  'cache-control': 'no-store'
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  };
}

function options() {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: ''
  };
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
    throw new Error('invalid_firebase_service_account');
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  return admin.app();
}

function getBearerToken(event) {
  const authorization = event.headers?.authorization || event.headers?.Authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

function hasAuthorizationHeader(event) {
  return Boolean(event.headers?.authorization || event.headers?.Authorization);
}

async function authenticate(event) {
  const token = getBearerToken(event);
  if (!token) {
    const error = new Error('unauthorized');
    error.statusCode = 401;
    throw error;
  }

  const app = getAdminApp();
  const auth = admin.auth(app);
  let decoded;
  let user;

  try {
    decoded = await auth.verifyIdToken(token, true);
    user = await auth.getUser(decoded.uid);
  } catch (cause) {
    const error = new Error('unauthorized');
    error.statusCode = 401;
    throw error;
  }

  return {
    auth,
    db: admin.firestore(app),
    user
  };
}

function isNcstEmail(email) {
  return /^[^@\s]+@ncst\.edu\.ph$/i.test(String(email || '').trim());
}

function hashOtp(uid, code) {
  const secret = process.env.OTP_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!secret) {
    throw new Error('missing_otp_secret');
  }

  return crypto.createHmac('sha256', secret)
    .update(`${uid}:${code}`)
    .digest('hex');
}

function safeHexEqual(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left || '') || !/^[a-f0-9]{64}$/i.test(right || '')) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

async function sendEmail(email, subject, html) {
  let sent = false;

  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.OTP_FROM_EMAIL || 'MathWizard <onboarding@resend.dev>',
          to: [email],
          subject,
          html
        })
      });
      sent = response.ok;
      if (!sent) {
        console.error('Resend delivery failed:', response.status);
      }
    } catch (error) {
      console.error('Resend delivery failed:', error.message);
    }
  }

  if (!sent && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"MathWizard" <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        html
      });
      sent = true;
    } catch (error) {
      console.error('SMTP delivery failed:', error.message);
    }
  }

  if (!sent) {
    throw new Error('email_delivery_failed');
  }
}

module.exports = {
  admin,
  authenticate,
  getBearerToken,
  hasAuthorizationHeader,
  hashOtp,
  isNcstEmail,
  json,
  options,
  safeHexEqual,
  sendEmail
};
