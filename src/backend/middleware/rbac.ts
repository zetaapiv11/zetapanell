import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from './auth.js';

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: this action requires one of the following roles: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    // Super Admin has all permissions
    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    // If using API Key, check granular key permissions
    if (req.isApiKey && req.apiKeyPermissions) {
      if (
        req.apiKeyPermissions.includes('*') ||
        req.apiKeyPermissions.includes(permission)
      ) {
        next();
        return;
      }
      res.status(403).json({
        error: `Forbidden: your API key lacks the required permission: '${permission}'`,
      });
      return;
    }

    // If standard user JWT, verify admin permissions if required
    if (permission.startsWith('admin.')) {
      if (req.user.role !== 'ADMIN') {
        res.status(403).json({
          error: `Forbidden: administrative permission '${permission}' required.`,
        });
        return;
      }
    }

    next();
  };
}
