import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/backend/config.js';
import { db } from '../src/backend/db/index.js';
import { EmailError, sendEmail } from '../src/backend/services/email.js';
import {
  issueOtp,
  OTP_MAX_ATTEMPTS,
  resetOtpId,
  verifyOtp,
} from '../src/backend/services/otp.js';

// With SMTP2GO unconfigured (and NODE_ENV != production) the email is printed
// instead of sent -- grab the code from that output.
function captureCode() {
  let code = '';
  const spy = vi.spyOn(console, 'warn').mockImplementation((msg: string) => {
    const m = /Your code: (\d{6})/.exec(String(msg));
    if (m) code = m[1];
  });
  return { get: () => code, restore: () => spy.mockRestore() };
}

describe('Email OTP', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    config.smtp2goApiKey = '';
    config.smtp2goSender = '';
  });

  it('issues a code, stores only its hash, and accepts it exactly once', async () => {
    const cap = captureCode();
    const issued = await issueOtp({
      email: 'Alice@Example.com',
      purpose: 'register',
      payload: { username: 'alice', passwordHash: 'hash' },
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;

    const code = cap.get();
    expect(code).toHaveLength(6);
    expect(db.getOtp(issued.id)?.codeHash).not.toContain(code);

    const first = verifyOtp(issued.id, 'register', code);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.record.email).toBe('alice@example.com');
      expect(first.record.payload?.username).toBe('alice');
    }
    expect(verifyOtp(issued.id, 'register', code)).toEqual({ ok: false, reason: 'expired' });
    cap.restore();
  });

  it('locks a code after too many wrong guesses', async () => {
    const cap = captureCode();
    const issued = await issueOtp({ email: 'lockout@example.com', purpose: 'reset' });
    expect(issued.ok).toBe(true);
    const code = cap.get();
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) {
      expect(verifyOtp(resetOtpId('lockout@example.com'), 'reset', wrong).ok).toBe(false);
    }
    expect(verifyOtp(resetOtpId('lockout@example.com'), 'reset', wrong)).toEqual({
      ok: false,
      reason: 'too_many_attempts',
    });
    // the right code no longer works either
    expect(verifyOtp(resetOtpId('lockout@example.com'), 'reset', code).ok).toBe(false);
    cap.restore();
  });

  it('does not let a register code be used for a password reset', async () => {
    const cap = captureCode();
    const issued = await issueOtp({
      email: 'purpose@example.com',
      purpose: 'register',
      payload: { username: 'p', passwordHash: 'h' },
    });
    if (!issued.ok) throw new Error('expected ok');
    expect(verifyOtp(issued.id, 'reset', cap.get()).ok).toBe(false);
    cap.restore();
  });

  it('enforces a cooldown between sends to the same address', async () => {
    const cap = captureCode();
    expect((await issueOtp({ email: 'cool@example.com', purpose: 'reset' })).ok).toBe(true);
    const again = await issueOtp({ email: 'cool@example.com', purpose: 'reset' });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('cooldown');
    cap.restore();
  });

  it('sends through the SMTP2GO HTTP API with the expected payload', async () => {
    config.smtp2goApiKey = 'api-test';
    config.smtp2goSender = 'no-reply@zeta.test';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { succeeded: 1, failed: 0, failures: [] } }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    await sendEmail({ to: 'x@example.com', subject: 'Hi', text: 'text', html: '<b>html</b>' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.smtp2go.com/v3/email/send');
    expect(init.headers['X-Smtp2go-Api-Key']).toBe('api-test');
    expect(JSON.parse(init.body)).toEqual({
      sender: 'no-reply@zeta.test',
      to: ['x@example.com'],
      subject: 'Hi',
      text_body: 'text',
      html_body: '<b>html</b>',
    });
    vi.unstubAllGlobals();
  });

  it('rolls back the code when SMTP2GO rejects the message', async () => {
    config.smtp2goApiKey = 'api-test';
    config.smtp2goSender = 'no-reply@zeta.test';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { error: 'nope' } }), { status: 400 })
      )
    );

    await expect(issueOtp({ email: 'rollback@example.com', purpose: 'reset' })).rejects.toBeInstanceOf(EmailError);
    expect(db.getOtp(resetOtpId('rollback@example.com'))).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
