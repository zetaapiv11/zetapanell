import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { User } from '../db/types.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  apiKeyPermissions?: string[];
  isApiKey?: boolean;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const xApiKey = req.headers['x-api-key'] as string | undefined;

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (xApiKey) {
    token = xApiKey.trim();
  }

  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Provide a valid Bearer token or API key.',
    });
    return;
  }

  // Check if it's an API Key (starts with zp_live_)
  if (token.startsWith('zp_live_')) {
    const keyHash = hashApiKey(token);
    const apiKeys = db.getApiKeys();
    const matchedKey = apiKeys.find((k) => k.keyHash === keyHash);

    if (!matchedKey) {
      res.status(401).json({ error: 'Invalid or revoked API key.' });
      return;
    }

    const user = db.getUserById(matchedKey.userId);
    if (!user || user.status === 'SUSPENDED') {
      res.status(403).json({ error: 'Account associated with this API key is suspended or inactive.' });
      return;
    }

    db.touchApiKey(matchedKey.id);
    req.user = user;
    req.isApiKey = true;
    req.apiKeyPermissions = matchedKey.permissions;
    next();
    return;
  }

  // Verify JWT
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    const user = db.getUserById(decoded.userId);

    if (!user) {
      res.status(401).json({ error: 'User session invalid. Please log in again.' });
      return;
    }

    if (user.status === 'SUSPENDED') {
      res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
      return;
    }

    req.user = user;
    req.isApiKey = false;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'Invalid or expired session token.',
      details: err.message,
    });
  }
}
