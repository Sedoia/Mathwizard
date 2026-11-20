/**
 * Netlify Serverless Function: verify-otp
 * Verifies a submitted 6-digit OTP against an HMAC verification token.
 * Stateless, fast, secure, and requires no database reads or writes.
 */

const crypto = require('crypto');

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
