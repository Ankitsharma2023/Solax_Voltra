// Email verification codes (SolaX-style "Send Verification Code").
// Sends over SMTP (any provider). Without SMTP_HOST, codes are printed to the server log so the
// flow can be tested locally — never in production.

import nodemailer from 'nodemailer';
import { randomInt, createHash, timingSafeEqual } from 'node:crypto';

const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, MAIL_FROM = 'Voltra Energy <no-reply@voltra.in>' } = process.env;
const PROD = process.env.NODE_ENV === 'production';
export const emailConfigured = Boolean(SMTP_HOST);
export const devCodes = !emailConfigured && !PROD;

const transport = emailConfigured && nodemailer.createTransport({
  host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

const CODE_TTL_MS = 10 * 60e3, RESEND_MS = 60e3, MAX_TRIES = 5, MAX_PER_HOUR = 5;
const codes = new Map();  // `${purpose}:${email}` → { hash, exp, tries, sentAt }
const sends = new Map();  // email → [timestamps] (hourly cap)
const sha = (s) => createHash('sha256').update(s).digest();

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
export const maskEmail = (e) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(6, Math.max(2, b.length))) + c);

const SUBJECT = { signup: 'Your Voltra verification code', reset: 'Reset your Voltra password' };
const INTRO = {
  signup: 'Use this code to finish creating your Voltra account.',
  reset: 'Use this code to set a new password for your Voltra account.',
};

// Returns { ok } or throws Error with a user-facing message.
export async function sendCode(email, purpose) {
  if (!emailConfigured && PROD) throw new Error('Email is not set up on this server yet. Please contact Voltra support.');
  const key = `${purpose}:${email}`;
  const prev = codes.get(key);
  if (prev && Date.now() - prev.sentAt < RESEND_MS) {
    throw new Error(`Please wait ${Math.ceil((RESEND_MS - (Date.now() - prev.sentAt)) / 1000)} s before requesting another code.`);
  }
  const recent = (sends.get(email) || []).filter((t) => Date.now() - t < 3600e3);
  if (recent.length >= MAX_PER_HOUR) throw new Error('Too many codes requested for this email. Try again in an hour.');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  codes.set(key, { hash: sha(code), exp: Date.now() + CODE_TTL_MS, tries: 0, sentAt: Date.now() });
  sends.set(email, [...recent, Date.now()]);

  if (!emailConfigured) {
    console.log(`\n[email not configured] ${purpose} code for ${email}: ${code}  (valid 10 min)\n`);
    return { ok: true };
  }
  await transport.sendMail({
    from: MAIL_FROM, to: email, subject: SUBJECT[purpose],
    text: `${INTRO[purpose]}\n\nVerification code: ${code}\n\nIt expires in 10 minutes. If you didn't ask for this, you can ignore this email.\n\nVoltra Energy`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#111827">
      <p style="font-size:15px">${INTRO[purpose]}</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0;color:#0f9488">${code}</p>
      <p style="font-size:13px;color:#6b7280">It expires in 10 minutes. If you didn't ask for this, you can ignore this email.</p>
      <p style="font-size:13px;color:#6b7280">Voltra Energy</p></div>`,
  }).catch((e) => { codes.delete(key); console.error('mail failed:', e.message); throw new Error('Could not send the email. Please try again later.'); });
  return { ok: true };
}

// One-time check: a correct code is consumed; 5 wrong tries burn it.
export function checkCode(email, purpose, code) {
  const key = `${purpose}:${email}`;
  const c = codes.get(key);
  if (!c) return 'Please tap "Send Verification Code" first.';
  if (c.exp < Date.now()) { codes.delete(key); return 'The verification code has expired. Please request a new one.'; }
  if (!/^\d{6}$/.test(String(code || '').trim())) return 'Please enter the 6-digit verification code.';
  c.tries += 1;
  if (!timingSafeEqual(sha(String(code).trim()), c.hash)) {
    if (c.tries >= MAX_TRIES) { codes.delete(key); return 'Too many wrong codes. Please request a new one.'; }
    return 'Incorrect verification code.';
  }
  codes.delete(key);
  return null;
}
