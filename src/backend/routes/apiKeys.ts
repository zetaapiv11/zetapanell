import crypto from 'node:crypto';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { AuthenticatedRequest, authMiddleware, hashApiKey } from '../middleware/auth.js';
import { logActivity } from '../services/audit.js';

export const apiKeysRouter = Router();

apiKeysRouter.use(authMiddleware);

// GET /api/v1/api-keys
apiKeysRouter.get('/', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const keys = db.getApiKeys(user.id).map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    permissions: k.permissions,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  }));

  res.json({
    object: 'list',
    data: keys,
  });
});

// POST /api/v1/api-keys
apiKeysRouter.post('/', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { name, permissions = ['servers.read', 'servers.deploy', 'servers.logs'] } = req.body;

  if (!name || name.trim().length < 2) {
    res.status(400).json({ error: 'Key name is required (min 2 characters).' });
    return;
  }

  // Generate secure token: zp_live_32chars
  const secretPart = crypto.randomBytes(24).toString('hex');
  const plaintextKey = `zp_live_${secretPart}`;
  const keyHash = hashApiKey(plaintextKey);
  const keyPrefix = `${plaintextKey.slice(0, 12)}...${plaintextKey.slice(-4)}`;

  const record = {
    id: `key_${uuidv4().slice(0, 10)}`,
    userId: user.id,
    name: name.trim(),
    keyPrefix,
    keyHash,
    permissions,
    createdAt: new Date().toISOString(),
  };

  db.createApiKey(record);

  logActivity({
    userId: user.id,
    username: user.username,
    action: 'api_key.create',
    details: `Created API key '${record.name}' with ${permissions.length} permission(s)`,
    ip: req.ip,
  });

  res.status(201).json({
    object: 'api_key',
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    permissions: record.permissions,
    createdAt: record.createdAt,
    secretToken: plaintextKey, // Only shown once!
  });
});

// DELETE /api/v1/api-keys/:id
apiKeysRouter.delete('/:id', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const id = req.params['id'] as string;

  const key = db.getApiKeyById(id);
  if (!key) {
    res.status(404).json({ error: 'API key not found.' });
    return;
  }

  if (key.userId !== user.id && user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }

  db.deleteApiKey(id);

  logActivity({
    userId: user.id,
    username: user.username,
    action: 'api_key.revoke',
    details: `Revoked API key '${key.name}' (${key.keyPrefix})`,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: `API Key '${key.name}' has been permanently revoked.`,
  });
});
