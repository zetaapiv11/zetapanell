import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { User } from '../db/types.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { logActivity } from '../services/audit.js';

export const authRouter = Router();

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

authRouter.post('/register', authLimiter, async (req, res) => {
  const settings = db.getSettings();
  if (!settings.allowRegistration) {
    res.status(403).json({ error: 'Public user registration is currently disabled.' });
    return;
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ error: 'Username, email, and password are required.' });
    return;
  }

  if (username.length < 3 || username.length > 32) {
    res.status(400).json({ error: 'Username must be between 3 and 32 characters.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
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
  const newUser: User = {
    id: `usr_${uuidv4().slice(0, 12)}`,
    username,
    email,
    passwordHash,
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
    details: `New account registered: ${newUser.username} (${newUser.email})`,
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
