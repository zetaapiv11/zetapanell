import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { OtpPurpose, OtpRecord } from '../db/types.js';
import { buildOtpEmail, sendEmail } from './email.js';

export const OTP_TTL_MS = 10 * 60 * 1000; // code is valid for 10 minutes
export const OTP_MAX_ATTEMPTS = 5; // wrong guesses allowed per code
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // min gap between sends to one email
export const OTP_MAX_SENDS_PER_HOUR = 5; // per email + purpose

const HOUR_MS = 60 * 60 * 1000;

// In-memory send history (per "purpose:email"). Caps how many codes -- and
// therefore how many guesses -- an attacker can get against one address.
// Resets on restart, which is fine for a rate limit.
const sendHistory = new Map<string, number[]>();

function recentSends(key: string, now: number): number[] {
  const recent = (sendHistory.get(key) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length) sendHistory.set(key, recent);
  else sendHistory.delete(key);
  return recent;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resetOtpId(email: string): string {
  return `reset:${normalizeEmail(email)}`;
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashCode(email: string, purpose: OtpPurpose, code: string): string {
  // Keyed with the JWT secret and bound to the email + purpose, so a hash from
  // one flow can't be replayed in another and a DB leak doesn't expose codes.
  return crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${purpose}:${email}:${code}`)
    .digest('hex');
}

export type IssueResult =
  | { ok: true; id: string; resendAfterSeconds: number; expiresInSeconds: number }
  | { ok: false; reason: 'cooldown' | 'hourly_limit'; retryAfterSeconds: number };

export async function issueOtp(opts: {
  email: string;
  purpose: OtpPurpose;
  payload?: OtpRecord['payload'];
  id?: string; // reuse an existing record id (resend); default: new for register, fixed for reset
}): Promise<IssueResult> {
  const email = normalizeEmail(opts.email);
  const now = Date.now();
  const historyKey = `${opts.purpose}:${email}`;
  const recent = recentSends(historyKey, now);

  const last = recent[recent.length - 1];
  if (last !== undefined && now - last < OTP_RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      reason: 'cooldown',
      retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - last)) / 1000),
    };
  }
  if (recent.length >= OTP_MAX_SENDS_PER_HOUR) {
    return {
      ok: false,
      reason: 'hourly_limit',
      retryAfterSeconds: Math.ceil((HOUR_MS - (now - recent[0])) / 1000),
    };
  }

  const id =
    opts.id ?? (opts.purpose === 'reset' ? resetOtpId(email) : `reg_${uuidv4().replace(/-/g, '')}`);
  const code = generateCode();

  db.saveOtp({
    id,
    email,
    purpose: opts.purpose,
    codeHash: hashCode(email, opts.purpose, code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    payload: opts.payload,
  });
  sendHistory.set(historyKey, [...recent, now]);

  try {
    const mail = buildOtpEmail({
      panelName: db.getSettings().panelName || 'ZetaPanel',
      purpose: opts.purpose,
      code,
      ttlMinutes: OTP_TTL_MS / 60_000,
    });
    await sendEmail({ to: email, ...mail });
  } catch (err) {
    // Don't leave a code nobody received (or a cooldown the user didn't cause).
    db.deleteOtp(id);
    sendHistory.set(historyKey, recent);
    throw err;
  }

  return {
    ok: true,
    id,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    expiresInSeconds: OTP_TTL_MS / 1000,
  };
}

export type VerifyResult =
  | { ok: true; record: OtpRecord }
  | { ok: false; reason: 'expired' | 'invalid' | 'too_many_attempts'; attemptsLeft?: number };

/**
 * Checks a code. Synchronous on purpose: read -> compare -> consume happens in
 * one tick, so the same code can't be redeemed twice by concurrent requests.
 */
export function verifyOtp(id: string, purpose: OtpPurpose, code: string): VerifyResult {
  const record = db.getOtp(id);
  if (!record || record.purpose !== purpose) {
    return { ok: false, reason: 'expired' };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    db.deleteOtp(id);
    return { ok: false, reason: 'too_many_attempts' };
  }

  if (!/^\d{6}$/.test(code)) {
    return { ok: false, reason: 'invalid', attemptsLeft: OTP_MAX_ATTEMPTS - record.attempts };
  }

  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(hashCode(record.email, purpose, code), 'hex');
  const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!match) {
    const attempts = record.attempts + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      db.deleteOtp(id);
      return { ok: false, reason: 'too_many_attempts' };
    }
    db.saveOtp({ ...record, attempts });
    return { ok: false, reason: 'invalid', attemptsLeft: OTP_MAX_ATTEMPTS - attempts };
  }

  db.deleteOtp(id); // single use
  return { ok: true, record };
}
