import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { User } from '../db/types.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { authLimiter, emailSendLimiter } from '../middleware/rateLimit.js';
import { logActivity } from '../services/audit.js';
import { EmailError } from '../services/email.js';
import {
  issueOtp,
  IssueResult,
  normalizeEmail,
  resetOtpId,
  verifyOtp,
  VerifyResult,
} from '../services/otp.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128;

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function sendOtpFailure(res: any, result: Extract<VerifyResult, { ok: false }>) {
  if (result.reason === 'too_many_attempts') {
    res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  } else if (result.reason === 'invalid') {
    const left = result.attemptsLeft ?? 0;
    res.status(400).json({
      error: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`,
    });
  } else {
    res.status(400).json({ error: 'This code has expired. Please request a new one.' });
  }
}

function sendIssueFailure(res: any, result: Extract<IssueResult, { ok: false }>) {
  res.setHeader('Retry-After', result.retryAfterSeconds);
  res.status(429).json({
    error:
      result.reason === 'cooldown'
        ? `Please wait ${result.retryAfterSeconds}s before requesting another code.`
        : 'Too many codes requested for this email. Please try again later.',
    retryAfterSeconds: result.retryAfterSeconds,
  });
}

authRouter.post('/login', authLimiter, async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    res.status(400).json({ error: 'Username/email and password are required.' });
    return;
  }

  const user =
    db.getUserByEmail(login) || db.getUserByUsername(login);

  if (!user) {
    res.status(401).json({ error: 'Invalid login credentials.' });
    return;
  }

  if (user.status === 'SUSPENDED') {
    res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid login credentials.' });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  logActivity({
    userId: user.id,
    username: user.username,
    action: 'user.login',
    details: `User ${user.username} logged in successfully`,
    ip: req.ip,
  });

  const { passwordHash: _, ...safeUser } = user;
  res.json({
    token,
    user: safeUser,
  });
});

// --- Registration (2 steps: submit details -> verify emailed OTP) -------------

authRouter.post('/register', authLimiter, emailSendLimiter, async (req, res) => {
  const settings = db.getSettings();
  if (!settings.allowRegistration) {
    res.status(403).json({ error: 'Public user registration is currently disabled.' });
    return;
  }

  const { username: rawUsername, email: rawEmail, password } = req.body ?? {};

  if (!isString(rawUsername) || !isString(rawEmail) || !isString(password) || !rawUsername.trim() || !rawEmail.trim() || !password) {
    res.status(400).json({ error: 'Username, email, and password are required.' });
    return;
  }

  const username = rawUsername.trim();
  const email = normalizeEmail(rawEmail);

  if (username.length < 3 || username.length > 32) {
    res.status(400).json({ error: 'Username must be between 3 and 32 characters.' });
    return;
  }

  if (!EMAIL_RE.test(email) || email.length > 128) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` });
    return;
  }

  if (db.getUserByUsername(username)) {
    res.status(409).json({ error: 'Username is already taken.' });
    return;
  }

  if (db.getUserByEmail(email)) {
    res.status(409).json({ error: 'Email address is already registered.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await issueOtp({
      email,
      purpose: 'register',
      payload: { username, passwordHash },
    });

    if (!result.ok) {
      sendIssueFailure(res, result);
      return;
    }

    // No account exists yet -- it's only created once the code is verified.
    // `registrationId` ties the verify/resend calls to this browser session, so
    // someone else who triggers a code to the same address can't hijack it.
    res.status(202).json({
      pendingVerification: true,
      registrationId: result.id,
      email,
      resendAfterSeconds: result.resendAfterSeconds,
      expiresInSeconds: result.expiresInSeconds,
    });
  } catch (err) {
    if (err instanceof EmailError) {
      res.status(503).json({ error: 'Could not send the verification email. Please try again later.' });
      return;
    }
    throw err;
  }
});

authRouter.post('/register/verify', authLimiter, async (req, res) => {
  const settings = db.getSettings();
  if (!settings.allowRegistration) {
    res.status(403).json({ error: 'Public user registration is currently disabled.' });
    return;
  }

  const { registrationId, code } = req.body ?? {};
  if (!isString(registrationId) || !isString(code)) {
    res.status(400).json({ error: 'Registration ID and verification code are required.' });
    return;
  }

  const result = verifyOtp(registrationId, 'register', code.trim());
  if (!result.ok) {
    sendOtpFailure(res, result);
    return;
  }

  const { email, payload } = result.record;
  if (!payload) {
    res.status(400).json({ error: 'This registration is no longer valid. Please sign up again.' });
    return;
  }

  // Re-check: someone may have taken the username/email while the code was pending.
  if (db.getUserByUsername(payload.username)) {
    res.status(409).json({ error: 'Username is already taken. Please sign up again.' });
    return;
  }
  if (db.getUserByEmail(email)) {
    res.status(409).json({ error: 'Email address is already registered.' });
    return;
  }

  const newUser: User = {
    id: `usr_${uuidv4().slice(0, 12)}`,
    username: payload.username,
    email,
    passwordHash: payload.passwordHash,
    role: 'USER',
    status: 'ACTIVE',
    plan: 'NONE',
    maxServers: 0,
    maxStorageMb: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createUser(newUser);

  logActivity({
    userId: newUser.id,
    username: newUser.username,
    action: 'user.register',
    details: `New account registered (email verified): ${newUser.username} (${newUser.email})`,
    ip: req.ip,
  });

  const token = jwt.sign(
    { userId: newUser.id, username: newUser.username, role: newUser.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json({
    token,
    user: safeUser,
  });
});

authRouter.post('/register/resend', authLimiter, emailSendLimiter, async (req, res) => {
  const { registrationId } = req.body ?? {};
  if (!isString(registrationId)) {
    res.status(400).json({ error: 'Registration ID is required.' });
    return;
  }

  const pending = db.getOtp(registrationId);
  if (!pending || pending.purpose !== 'register') {
    res.status(404).json({ error: 'This sign-up has expired. Please start again.' });
    return;
  }

  try {
    const result = await issueOtp({
      email: pending.email,
      purpose: 'register',
      payload: pending.payload,
      id: pending.id,
    });

    if (!result.ok) {
      sendIssueFailure(res, result);
      return;
    }

    res.json({
      success: true,
      resendAfterSeconds: result.resendAfterSeconds,
      expiresInSeconds: result.expiresInSeconds,
    });
  } catch (err) {
    if (err instanceof EmailError) {
      res.status(503).json({ error: 'Could not send the verification email. Please try again later.' });
      return;
    }
    throw err;
  }
});

// --- Password reset (forgot -> emailed OTP -> new password) ------------------

authRouter.post('/forgot-password', authLimiter, emailSendLimiter, async (req, res) => {
  const { email: rawEmail } = req.body ?? {};
  if (!isString(rawEmail) || !EMAIL_RE.test(normalizeEmail(rawEmail))) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const email = normalizeEmail(rawEmail);
  const user = db.getUserByEmail(email);

  // Same response whether or not the account exists, so this endpoint can't be
  // used to find out which emails are registered. The send is not awaited for
  // the same reason (response time would otherwise reveal a hit).
  if (user && user.status !== 'SUSPENDED') {
    issueOtp({ email, purpose: 'reset' }).catch((err) => {
      console.error('[Auth] Failed to send password reset code:', err);
    });
  }

  res.json({
    success: true,
    message: 'If an account exists for that email, a 6-digit reset code has been sent.',
    resendAfterSeconds: 60,
  });
});

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const { email: rawEmail, code, newPassword } = req.body ?? {};
  if (!isString(rawEmail) || !isString(code) || !isString(newPassword)) {
    res.status(400).json({ error: 'Email, code, and new password are required.' });
    return;
  }

  // Validate the password first so a typo doesn't burn the one-time code.
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` });
    return;
  }

  const email = normalizeEmail(rawEmail);
  const result = verifyOtp(resetOtpId(email), 'reset', code.trim());
  if (!result.ok) {
    sendOtpFailure(res, result);
    return;
  }

  const user = db.getUserByEmail(email);
  if (!user || user.status === 'SUSPENDED') {
    res.status(400).json({ error: 'This code has expired. Please request a new one.' });
    return;
  }

  const now = new Date().toISOString();
  db.updateUser(user.id, {
    passwordHash: await bcrypt.hash(newPassword, 10),
    passwordChangedAt: now,
  });

  logActivity({
    userId: user.id,
    username: user.username,
    action: 'user.reset_password',
    details: `Password reset via email code for ${user.username}`,
    ip: req.ip,
  });

  res.json({ success: true, message: 'Password updated. You can now log in.' });
});

authRouter.get('/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  const { passwordHash: _, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Pterodactyl-style handler, also mounted directly at GET /api/v1/user (see api.ts)
export function pterodactylUserHandler(req: AuthenticatedRequest, res: any) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  const { passwordHash: _, ...safeUser } = req.user;
  res.json({
    object: 'user',
    attributes: safeUser,
  });
}

authRouter.get('/user', authMiddleware, pterodactylUserHandler);

authRouter.patch('/account', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const { email, currentPassword, newPassword } = req.body;
  const updates: Partial<User> = {};

  if (email && email !== req.user.email) {
    const existing = db.getUserByEmail(email);
    if (existing && existing.id !== req.user.id) {
      res.status(409).json({ error: 'Email address already in use.' });
      return;
    }
    updates.email = email.trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required to set a new password.' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const updated = db.updateUser(req.user.id, updates);
  if (!updated) {
    res.status(500).json({ error: 'Failed to update account.' });
    return;
  }

  logActivity({
    userId: req.user.id,
    username: req.user.username,
    action: 'user.update_account',
    details: `User updated account information (${Object.keys(updates).join(', ')})`,
    ip: req.ip,
  });

  const { passwordHash: _, ...safeUser } = updated;
  res.json({
    success: true,
    user: safeUser,
  });
});
