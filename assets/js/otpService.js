/**
 * OTP (One-Time Password) Service
 * Manages OTP requests, token storage, and verification.
 * Communicates with Netlify serverless functions (stateless, cryptographically signed).
 * Does NOT require client-side Firestore access, preventing permission errors.
 */

class OTPService {
    constructor() {
        this.token = null;
        this.expiresAt = null;
        this.email = null;
        this.purpose = null;
        this.attempts = 0;
        this.MAX_ATTEMPTS = 5;
    }

    /**
     * Send an OTP to the given email address.
     * Calls Netlify function /.netlify/functions/send-otp
     *
     * @param {string} email - Recipient email
     * @param {string} purpose - 'registration' or 'login'
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async sendOTP(email, purpose = 'registration') {
        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail) {
            throw new Error('Email is required to send verification code.');
        }

        this.attempts = 0;
        this.email = normalizedEmail;
        this.purpose = purpose;

        const response = await fetch('/.netlify/functions/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: normalizedEmail,
                purpose: purpose
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to send verification code. Please try again.');
        }

        this.token = data.token;
        this.expiresAt = data.expiresAt;

        return {
            success: true,
            message: data.message || 'Verification code sent to your NCST email address.'
        };
    }

    /**
     * Verify user-submitted OTP code.
     *
     * @param {string} email - The email the OTP was sent to
     * @param {string} code - The 6-digit code entered by user
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async verifyOTP(email, code) {
        const normalizedEmail = (email || '').trim().toLowerCase();
        const normalizedCode = (code || '').trim();

        if (!normalizedEmail || !normalizedCode) {
            return { success: false, message: 'Please enter all 6 digits of the verification code.' };
        }

        if (normalizedCode.length !== 6) {
            return { success: false, message: 'Code must be exactly 6 digits.' };
        }

        // Check attempts
        this.attempts += 1;
        if (this.attempts > this.MAX_ATTEMPTS) {
            return { success: false, message: 'Too many incorrect attempts. Please click "Resend Code".' };
        }

        // Check local expiry
        if (this.expiresAt && Date.now() > this.expiresAt) {
            return { success: false, message: 'Verification code has expired. Please request a new code.' };
        }

        try {
            const response = await fetch('/.netlify/functions/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: normalizedEmail,
                    code: normalizedCode,
                    token: this.token,
                    expiresAt: this.expiresAt,
                    purpose: this.purpose
                })
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && data.success) {
                return { success: true, message: 'Email verified successfully!' };
            }

            const remaining = this.MAX_ATTEMPTS - this.attempts;
            const errorMsg = data.error || data.message || 'Incorrect verification code.';
            return {
                success: false,
                message: remaining > 0 ? `${errorMsg} (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)` : errorMsg
            };
        } catch (err) {
            console.error('verify-otp network error:', err);
            return { success: false, message: 'Verification request failed. Please check your connection and try again.' };
        }
    }

    /**
     * Resend OTP code.
     */
    async resendOTP(email, purpose = 'registration') {
        return this.sendOTP(email, purpose);
    }

    /**
     * Clear active OTP state.
     */
    cleanupOTP() {
        this.token = null;
        this.expiresAt = null;
        this.email = null;
        this.purpose = null;
        this.attempts = 0;
    }

    /**
     * Mask email for display (e.g. s***@ncst.edu.ph)
     */
    maskEmail(email) {
        if (!email || !email.includes('@')) return email || '';
        const [local, domain] = email.split('@');
        if (local.length <= 2) {
            return local[0] + '***@' + domain;
        }
        return local[0] + '***' + local[local.length - 1] + '@' + domain;
    }
}

const otpService = new OTPService();
window.otpService = otpService;
