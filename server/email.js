import nodemailer from 'nodemailer';

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Dev fallback — logs to console, no actual email sent
  return null;
}

const FROM = process.env.EMAIL_FROM || 'BulkBatch <noreply@batch.app>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function send({ to, subject, html, text }) {
  const transport = createTransport();
  if (!transport) {
    console.log(`\n  ──── EMAIL (dev mode — not sent) ────`);
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body:    ${text}`);
    console.log(`  ─────────────────────────────────────\n`);
    return;
  }
  await transport.sendMail({ from: FROM, to, subject, html, text });
}

export async function sendVerificationEmail(email, code) {
  await send({
    to: email,
    subject: 'Verify your BulkBatch account',
    text: `Your BulkBatch verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#B14DFF">BulkBatch</h2>
        <p>Welcome! Enter this code to verify your email:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;
                    background:#f4f0ff;border-radius:8px;padding:20px;margin:24px 0">
          ${code}
        </div>
        <p style="color:#888;font-size:13px">Expires in 10 minutes. If you didn't sign up, ignore this email.</p>
      </div>`,
  });
}

export async function sendPasswordResetEmail(email, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await send({
    to: email,
    subject: 'Reset your BulkBatch password',
    text: `Reset your password: ${link}\n\nThis link expires in 1 hour.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#B14DFF">BulkBatch</h2>
        <p>Click below to reset your password:</p>
        <a href="${link}"
           style="display:inline-block;background:#B14DFF;color:#fff;padding:14px 28px;
                  border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#888;font-size:13px">Link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>`,
  });
}
