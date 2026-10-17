// Email verification codes (SolaX-style "Send Verification Code").
// Sends through an e-mail API over HTTPS (BREVO_API_KEY or RESEND_API_KEY) or plain SMTP (SMTP_HOST).
// Render's free plan blocks outgoing SMTP ports, so the live server uses an API. With none configured,
// codes are printed to the server log so the flow can be tested locally — never in production.

import nodemailer from 'nodemailer';
import { randomInt, createHash, timingSafeEqual } from 'node:crypto';

const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, BREVO_API_KEY, RESEND_API_KEY, MAIL_FROM = 'Voltra Energy <no-reply@voltra.in>' } = process.env;
const PROD = process.env.NODE_ENV === 'production';
export const emailConfigured = Boolean(BREVO_API_KEY || RESEND_API_KEY || SMTP_HOST);
// VERIFY_CODES_IN_LOG=true lets an online test server print codes to its log until email is set up.
const LOG_CODES = process.env.VERIFY_CODES_IN_LOG === 'true';
export const devCodes = !emailConfigured && (!PROD || LOG_CODES);

const smtp = SMTP_HOST && nodemailer.createTransport({
  host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  connectionTimeout: 15e3, greetingTimeout: 15e3, socketTimeout: 30e3, // fail fast instead of hanging
});

// "Voltra Energy <no-reply@voltra.in>" → { name, email }
const FROM = (() => { const m = /^(.*)<(.+)>$/.exec(MAIL_FROM); return m ? { name: m[1].trim(), email: m[2].trim() } : { name: 'Voltra Energy', email: MAIL_FROM.trim() }; })();

async function postJson(url, headers, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(20e3) });
  if (!r.ok) throw new Error(`${url} → ${r.status} ${(await r.text()).slice(0, 300)}`);
}

// One message through whichever provider is configured (Brevo, then Resend, then SMTP).
async function deliver({ to, subject, text, html }) {
  if (BREVO_API_KEY) {
    return postJson('https://api.brevo.com/v3/smtp/email', { 'api-key': BREVO_API_KEY },
      { sender: FROM, to: [{ email: to }], subject, textContent: text, htmlContent: html || undefined });
  }
  if (RESEND_API_KEY) {
    return postJson('https://api.resend.com/emails', { Authorization: `Bearer ${RESEND_API_KEY}` },
      { from: MAIL_FROM, to: [to], subject, text, html: html || undefined });
  }
  return smtp.sendMail({ from: MAIL_FROM, to, subject, text, html });
}
export const emailProvider = BREVO_API_KEY ? 'brevo' : RESEND_API_KEY ? 'resend' : SMTP_HOST ? 'smtp' : 'none';

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
  if (!emailConfigured && PROD && !LOG_CODES) throw new Error('Email is not set up on this server yet. Please contact Voltra support.');
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
  await deliver({
    to: email, subject: SUBJECT[purpose],
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

// Any other e-mail (e.g. alarm alerts). Silently skipped when e-mail isn't configured.
export async function sendEmail(to, subject, text, html) {
  if (!emailConfigured) { if (!PROD) console.log(`[email not configured] would send "${subject}" to ${to}`); return false; }
  try { await deliver({ to, subject, text, html }); return true; }
  catch (e) { console.error('mail failed:', e.message); return false; }
}
