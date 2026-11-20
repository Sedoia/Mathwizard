/**
 * OTP (One-Time Password) Service
 * Handles OTP generation, storage in Firestore, email delivery via Netlify function, and verification.
 */

class OTPService {
    constructor() {
        this.OTP_COLLECTION = 'otp_verifications';
        this.OTP_LENGTH = 6;
        this.OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
        this.MAX_ATTEMPTS = 5;
        this.RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

        this._firebaseReady = this._waitForFirebase();
    }

    async _waitForFirebase() {
        if (window.firebaseDb) return;

        const maxAttempts = 80;
        let attempts = 0;
        while (!window.firebaseDb && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts += 1;
        }

        if (!window.firebaseDb) {
            throw new Error('Firebase Firestore not initialized. OTP service unavailable.');
        }
    }

    /**
     * Generate a cryptographically random 6-digit OTP code
     */
    generateOTP() {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        const code = String(array[0] % 1000000).padStart(this.OTP_LENGTH, '0');
        return code;
    }

    /**
     * Send an OTP to the given email address.
     * Stores it in Firestore and calls the Netlify function to deliver the email.
     *
     * @param {string} email - Recipient email
     * @param {string} purpose - 'registration' or 'login'
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async sendOTP(email, purpose = 'registration') {
        await this._firebaseReady;

        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail) {
            throw new Error('Email is required to send OTP.');
        }

        const code = this.generateOTP();
        const now = Date.now();
        const docId = normalizedEmail.replace(/[^a-z0-9]/g, '_');

        // Store OTP record in Firestore
        const otpRef = window.firebaseDb.collection(this.OTP_COLLECTION).doc(docId);
        await otpRef.set({
            email: normalizedEmail,
            code: code,
            purpose: purpose,
            createdAt: now,
            expiresAt: now + this.OTP_EXPIRY_MS,
            attempts: 0,
            verified: false
        });

        // Call Netlify function to send email
        try {
            const response = await fetch('/.netlify/functions/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: normalizedEmail,
                    code: code,
                    purpose: purpose
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn('OTP email delivery warning:', errorData.error || response.statusText);
                // Don't throw - OTP is stored in Firestore regardless
                return {
                    success: true,
                    message: 'Verification code generated. If email delivery fails, please try resending.',
                    emailSent: false
                };
            }

            return {
                success: true,
                message: 'Verification code sent to your email.',
                emailSent: true
            };
        } catch (networkErr) {
            console.warn('OTP email network error:', networkErr?.message || networkErr);
            // OTP still stored in Firestore - verification will work
            return {
                success: true,
                message: 'Verification code generated. Email delivery may be delayed.',
                emailSent: false
            };
        }
    }

    /**
     * Verify a user-submitted OTP code against the stored record.
     *
     * @param {string} email - The email the OTP was sent to
     * @param {string} code - The 6-digit code the user entered
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async verifyOTP(email, code) {
        await this._firebaseReady;

        const normalizedEmail = (email || '').trim().toLowerCase();
        const normalizedCode = (code || '').trim();

        if (!normalizedEmail || !normalizedCode) {
            return { success: false, message: 'Email and verification code are required.' };
        }

        const docId = normalizedEmail.replace(/[^a-z0-9]/g, '_');
        const otpRef = window.firebaseDb.collection(this.OTP_COLLECTION).doc(docId);
        const otpDoc = await otpRef.get();

        if (!otpDoc.exists) {
            return { success: false, message: 'No verification code found. Please request a new one.' };
        }

        const otpData = otpDoc.data();

        // Check if already verified
        if (otpData.verified) {
            return { success: false, message: 'This code has already been used. Please request a new one.' };
        }

        // Check expiry
        if (Date.now() > otpData.expiresAt) {
            return { success: false, message: 'Verification code has expired. Please request a new one.' };
        }

        // Check max attempts
        if (otpData.attempts >= this.MAX_ATTEMPTS) {
            return { success: false, message: 'Too many failed attempts. Please request a new code.' };
        }

        // Increment attempt counter
        await otpRef.update({
            attempts: (otpData.attempts || 0) + 1
        });

        // Compare codes
        if (normalizedCode !== otpData.code) {
            const remaining = this.MAX_ATTEMPTS - (otpData.attempts + 1);
            return {
                success: false,
                message: remaining > 0
                    ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                    : 'Too many failed attempts. Please request a new code.'
            };
        }

        // Success - mark as verified
        await otpRef.update({ verified: true });

        return { success: true, message: 'Email verified successfully!' };
    }

    /**
     * Resend OTP - generates a new code and re-sends the email.
     *
     * @param {string} email
     * @param {string} purpose - 'registration' or 'login'
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async resendOTP(email, purpose = 'registration') {
        return this.sendOTP(email, purpose);
    }

    /**
     * Clean up OTP document after successful verification (optional cleanup).
     */
    async cleanupOTP(email) {
        await this._firebaseReady;

        const normalizedEmail = (email || '').trim().toLowerCase();
        const docId = normalizedEmail.replace(/[^a-z0-9]/g, '_');

        try {
            await window.firebaseDb.collection(this.OTP_COLLECTION).doc(docId).delete();
        } catch (err) {
            console.warn('OTP cleanup warning:', err?.message || err);
        }
    }

    /**
     * Mask an email for display (e.g., s***@ncst.edu.ph)
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
