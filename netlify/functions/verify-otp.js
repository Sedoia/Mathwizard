/**
 * Netlify Serverless Function: verify-otp
 * Supports the website's legacy signup verification and Unity's authenticated verification.
 * Unity sends a Firebase ID token plus { code }; signup continues using its signed token payload.
 */

const crypto = require('crypto');
const {
    admin,
    authenticate,
    hasAuthorizationHeader,
    hashOtp,
    isNcstEmail,
    json,
    options,
    safeHexEqual
} = require('./otp-common');

const MAX_ATTEMPTS = 5;

function getSecret() {
    return process.env.OTP_SECRET ||
        process.env.FIREBASE_PRIVATE_KEY ||
        'mathwizard-arcane-cryptographic-salt-2026';
}

function verifyToken(email, code, expiresAt, purpose, token) {
    const data = `${email.toLowerCase()}:${code}:${expiresAt}:${purpose}`;
    const expectedToken = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');

    if (token.length !== expectedToken.length) {
        return false;
    }

    try {
        return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expectedToken, 'hex'));
    } catch (e) {
        return false;
    }
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return options();
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return {
            statusCode: 400,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid JSON body' })
        };
    }

    if (hasAuthorizationHeader(event) || (!body.token && !body.expiresAt)) {
        try {
            const { auth, db, user } = await authenticate(event);
            const email = String(user.email || '').trim().toLowerCase();
            if (!isNcstEmail(email)) {
                return json(403, { error: 'ncst_email_required' });
            }

            const code = String(body.code || '').trim();
            if (!/^\d{6}$/.test(code)) {
                return json(400, { error: 'invalid_code' });
            }

            const ref = db.collection('otp_verifications').doc(`unity_${user.uid}`);
            const verification = await db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(ref);
                if (!snapshot.exists) {
                    return { error: 'no_active_code' };
                }

                const data = snapshot.data();
                const expiresAt = data.expiresAt?.toMillis?.();
                if (!expiresAt || expiresAt <= Date.now()) {
                    transaction.delete(ref);
                    return { error: 'code_expired' };
                }

                const attempts = Number(data.attempts || 0);
                if (attempts >= MAX_ATTEMPTS) {
                    return { error: 'too_many_attempts' };
                }

                if (!safeHexEqual(data.codeHash, hashOtp(user.uid, code))) {
                    const nextAttempts = attempts + 1;
                    transaction.update(ref, { attempts: nextAttempts });
                    return {
                        error: nextAttempts >= MAX_ATTEMPTS ? 'too_many_attempts' : 'wrong_code'
                    };
                }

                return {
                    requestId: data.requestId,
                    verified: true
                };
            });

            if (verification.error) {
                const statusCode = verification.error === 'too_many_attempts' ? 429
                    : verification.error === 'code_expired' ? 410
                    : verification.error === 'no_active_code' ? 404
                    : 400;
                return json(statusCode, { error: verification.error });
            }

            await auth.setCustomUserClaims(user.uid, {
                ...(user.customClaims || {}),
                ncstVerified: true
            });

            try {
                await db.runTransaction(async (transaction) => {
                    const snapshot = await transaction.get(ref);
                    if (snapshot.exists && snapshot.data()?.requestId === verification.requestId) {
                        transaction.delete(ref);
                    }
                });
            } catch (error) {
                console.error('verify-otp cleanup failed:', error);
            }

            return json(200, {
                success: true,
                ncstVerified: true,
                refreshTokenRequired: true
            });
        } catch (error) {
            if (error.statusCode) {
                return json(error.statusCode, { error: 'unauthorized' });
            }
            console.error('verify-otp authenticated request failed:', error);
            return json(500, {
                error: error.message === 'missing_otp_secret'
                    ? 'server_configuration_error'
                    : 'internal_error'
            });
        }
    }

    const email = (body.email || '').trim().toLowerCase();
    const code = (body.code || '').trim();
    const token = (body.token || '').trim();
    const expiresAt = Number(body.expiresAt || 0);
    const purpose = body.purpose === 'login' ? 'login' : 'registration';

    if (!email || !code || !token || !expiresAt) {
        return {
            statusCode: 400,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: 'Missing required verification fields.' })
        };
    }

    // Check expiration
    if (Date.now() > expiresAt) {
        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Verification code has expired. Please request a new code.'
            })
        };
    }

    // Verify cryptographic token
    const isValid = verifyToken(email, code, expiresAt, purpose, token);

    if (!isValid) {
        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Incorrect verification code. Please check your email and try again.'
            })
        };
    }

    return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            success: true,
            message: 'Email successfully verified!'
        })
    };
};
