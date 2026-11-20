/**
 * Netlify Serverless Function: send-otp
 * Sends OTP verification emails using nodemailer (SMTP) or Resend API.
 *
 * Environment variables required (set in Netlify dashboard):
 *   Option A (SMTP/Gmail App Password):
 *     SMTP_HOST=smtp.gmail.com
 *     SMTP_PORT=587
 *     SMTP_USER=your-email@gmail.com
 *     SMTP_PASS=your-app-password
 *
 *   Option B (Resend):
 *     RESEND_API_KEY=re_xxxxxxxxxxxx
 *     OTP_FROM_EMAIL=noreply@yourdomain.com
 */

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid JSON body' })
        };
    }

    const { email, code, purpose } = body;

    if (!email || !code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields: email, code' })
        };
    }

    const purposeLabel = purpose === 'login' ? 'Login Verification' : 'Registration Verification';
    const subject = `MathWizard - ${purposeLabel} Code: ${code}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width:480px;margin:40px auto;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;overflow:hidden;border:1px solid rgba(201,168,76,0.3);box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#c9a84c 0%,#8b6914 100%);padding:24px 32px;text-align:center;">
            <h1 style="margin:0;color:#0a0a0f;font-size:28px;font-weight:700;letter-spacing:3px;">MATH<span style="font-weight:400;">WIZARD</span></h1>
            <p style="margin:4px 0 0;color:rgba(10,10,15,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;">The Era of Mages</p>
        </div>

        <!-- Body -->
        <div style="padding:32px;">
            <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:rgba(201,168,76,0.15);border:2px solid rgba(201,168,76,0.3);line-height:56px;font-size:24px;">🛡️</div>
            </div>

            <h2 style="color:#e8d5a3;text-align:center;font-size:20px;margin:0 0 8px;font-weight:600;">${purposeLabel}</h2>
            <p style="color:rgba(232,213,163,0.6);text-align:center;font-size:13px;margin:0 0 28px;">Use the arcane code below to verify your identity</p>

            <!-- OTP Code -->
            <div style="background:rgba(0,0,0,0.3);border:2px solid rgba(201,168,76,0.4);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 8px;color:rgba(232,213,163,0.5);font-size:11px;text-transform:uppercase;letter-spacing:2px;">Your Verification Code</p>
                <p style="margin:0;color:#c9a84c;font-size:36px;font-weight:700;letter-spacing:12px;font-family:'Courier New',monospace;">${code}</p>
            </div>

            <p style="color:rgba(232,213,163,0.5);font-size:12px;text-align:center;margin:0 0 8px;">⏱ This code expires in <strong style="color:#c9a84c;">5 minutes</strong></p>
            <p style="color:rgba(232,213,163,0.4);font-size:11px;text-align:center;margin:0;">If you didn't request this code, you can safely ignore this email.</p>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;border-top:1px solid rgba(201,168,76,0.15);text-align:center;">
            <p style="margin:0;color:rgba(232,213,163,0.3);font-size:10px;letter-spacing:1px;">© 2026 MathWizard · National College of Science and Technology</p>
        </div>
    </div>
</body>
</html>`;

    // --- Strategy 1: Resend API ---
    if (process.env.RESEND_API_KEY) {
        try {
            const fromEmail = process.env.OTP_FROM_EMAIL || 'MathWizard <noreply@mathwizard.dev>';
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: [email],
                    subject: subject,
                    html: htmlBody
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('Resend API error:', res.status, errText);
                return {
                    statusCode: 502,
                    body: JSON.stringify({ error: 'Email delivery failed', detail: errText })
                };
            }

            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, method: 'resend' })
            };
        } catch (err) {
            console.error('Resend error:', err);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Email service error', detail: err.message })
            };
        }
    }

    // --- Strategy 2: Nodemailer SMTP ---
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const nodemailer = require('nodemailer');

            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587', 10),
                secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            await transporter.sendMail({
                from: process.env.SMTP_FROM || `"MathWizard" <${process.env.SMTP_USER}>`,
                to: email,
                subject: subject,
                html: htmlBody
            });

            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, method: 'smtp' })
            };
        } catch (err) {
            console.error('SMTP error:', err);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'SMTP delivery failed', detail: err.message })
            };
        }
    }

    // --- No email provider configured ---
    console.warn('No email provider configured (RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS). OTP stored in Firestore only.');
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            method: 'none',
            warning: 'No email provider configured. OTP stored in Firestore for verification but email was not sent.'
        })
    };
};
