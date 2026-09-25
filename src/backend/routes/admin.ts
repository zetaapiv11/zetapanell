import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { User, UserRole, UserStatus } from '../db/types.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logActivity } from '../services/audit.js';
import { renderApi } from '../services/render.js';
import { r2Storage } from '../services/storage.js';
import { postgresService } from '../db/postgres.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware);
adminRouter.use(requireRole('ADMIN', 'SUPER_ADMIN'));

// GET /api/v1/admin/overview
adminRouter.get('/overview', async (req: AuthenticatedRequest, res) => {
  const users = db.getUsers();
  const servers = db.getServers();
  const settings = db.getSettings();

  const activeServers = servers.filter((s) => s.status === 'ONLINE').length;
  const buildingServers = servers.filter((s) => s.status === 'BUILDING' || s.status === 'DEPLOYING').length;
  const failedServers = servers.filter((s) => s.status === 'FAILED').length;
  const suspendedServers = servers.filter((s) => s.status === 'SUSPENDED').length;

  let renderConnected = false;
  let renderWorkspacesCount = 0;
  let renderError: string | null = null;

  try {
    const owners = await renderApi.listOwners();
    renderConnected = true;
    renderWorkspacesCount = owners.length;
  } catch (err: any) {
    renderError = err.message;
  }

  res.json({
    usersCount: users.length,
    serversCount: servers.length,
    serversBreakdown: {
      online: activeServers,
      deploying: buildingServers,
      failed: failedServers,
      suspended: suspendedServers,
    },
    infrastructure: {
      renderConnected,
      renderWorkspacesCount,
      renderError,
      activeWorkspace: settings.renderOwnerName || settings.renderOwnerId || 'Auto',
      r2Configured: Boolean(settings.r2AccountId && settings.r2AccessKeyId),
      r2Bucket: settings.r2Bucket,
    },
    settings: {
      panelName: settings.panelName,
      allowRegistration: settings.allowRegistration,
      maintenanceMode: settings.maintenanceMode,
    },
  });
});

// GET /api/v1/admin/users
adminRouter.get('/users', (req: AuthenticatedRequest, res) => {
  const users = db.getUsers().map(({ passwordHash: _, ...u }) => u);
  res.json({ object: 'list', data: users });
});

// POST /api/v1/admin/users - Admin create user
adminRouter.post('/users', async (req: AuthenticatedRequest, res) => {
  const { username, email, password, role = 'USER', maxServers = 5, maxStorageMb = 1024 } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ error: 'Username, email, and password are required.' });
    return;
  }

  if (db.getUserByUsername(username)) {
    res.status(409).json({ error: 'Username is already in use.' });
    return;
  }

  if (db.getUserByEmail(email)) {
    res.status(409).json({ error: 'Email is already in use.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser: User = {
    id: `usr_${uuidv4().slice(0, 12)}`,
    username,
    email,
    passwordHash,
    role: role as UserRole,
    status: 'ACTIVE',
    maxServers: Number(maxServers) || 5,
    maxStorageMb: Number(maxStorageMb) || 1024,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createUser(newUser);

  logActivity({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'admin.user_create',
    details: `Admin created user '${newUser.username}' (${newUser.email}, role: ${newUser.role})`,
    ip: req.ip,
  });

  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json({ object: 'user', attributes: safeUser });
});

// PATCH /api/v1/admin/users/:id - Admin update user
adminRouter.patch('/users/:id', async (req: AuthenticatedRequest, res) => {
  const id = req.params['id'] as string;
  const targetUser = db.getUserById(id);
  if (!targetUser) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const { email, role, status, maxServers, maxStorageMb, plan, password } = req.body;
  const updates: Partial<User> = {};

  if (plan !== undefined) {
    updates.plan = plan;
  }

  if (email && email !== targetUser.email) {
    if (db.getUserByEmail(email)) {
      res.status(409).json({ error: 'Email already in use.' });
      return;
    }
    updates.email = email;
  }

  if (role && (role === 'USER' || role === 'ADMIN' || role === 'SUPER_ADMIN')) {
    // Only SUPER_ADMIN can promote/demote other admins
    if (req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only Super Admins can alter roles.' });
      return;
    }
    updates.role = role as UserRole;
  }

  if (status && (status === 'ACTIVE' || status === 'SUSPENDED')) {
    updates.status = status as UserStatus;
  }

  if (maxServers !== undefined) updates.maxServers = Number(maxServers);
  if (maxStorageMb !== undefined) updates.maxStorageMb = Number(maxStorageMb);

  if (password) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }

  const updated = db.updateUser(id, updates);

  logActivity({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'admin.user_update',
    details: `Admin updated user '${targetUser.username}' (fields: ${Object.keys(updates).join(', ')})`,
    ip: req.ip,
  });

  const { passwordHash: _, ...safeUser } = updated!;
  res.json({ object: 'user', attributes: safeUser });
});

// DELETE /api/v1/admin/users/:id
adminRouter.delete('/users/:id', (req: AuthenticatedRequest, res) => {
  const id = req.params['id'] as string;
  const targetUser = db.getUserById(id);
  if (!targetUser) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (targetUser.role === 'SUPER_ADMIN' && req.user!.id !== targetUser.id) {
    res.status(403).json({ error: 'Cannot delete Super Admin account.' });
    return;
  }

  db.deleteUser(id);

  logActivity({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'admin.user_delete',
    details: `Admin deleted user '${targetUser.username}' (${targetUser.email}) and associated resources`,
    ip: req.ip,
  });

  res.json({ success: true, message: `User '${targetUser.username}' deleted.` });
});

// GET /api/v1/admin/settings
adminRouter.get('/settings', (req: AuthenticatedRequest, res) => {
  const settings = db.getSettings();
  // Mask sensitive secret values for security
  res.json({
    ...settings,
    renderApiKeyMasked: settings.renderApiKey ? `••••••••${settings.renderApiKey.slice(-4)}` : '',
    r2SecretAccessKeyMasked: settings.r2SecretAccessKey ? `••••••••${settings.r2SecretAccessKey.slice(-4)}` : '',
  });
});

// PUT /api/v1/admin/settings
adminRouter.put('/settings', (req: AuthenticatedRequest, res) => {
  const {
    panelName,
    panelLogo,
    panelUrl,
    allowRegistration,
    maintenanceMode,
    defaultRegion,
    defaultRuntime,
    defaultPlan,
    maxServersPerUser,
    maxStorageMbPerUser,
    renderApiKey,
    renderOwnerId,
    r2AccountId,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2Bucket,
  } = req.body;

  const updates: any = {};
  if (panelName !== undefined) updates.panelName = panelName;
  if (panelLogo !== undefined) updates.panelLogo = panelLogo;
  if (panelUrl !== undefined) updates.panelUrl = panelUrl;
  if (allowRegistration !== undefined) updates.allowRegistration = Boolean(allowRegistration);
  if (maintenanceMode !== undefined) updates.maintenanceMode = Boolean(maintenanceMode);
  if (defaultRegion !== undefined) updates.defaultRegion = defaultRegion;
  if (defaultRuntime !== undefined) updates.defaultRuntime = defaultRuntime;
  if (defaultPlan !== undefined) updates.defaultPlan = defaultPlan;
  if (maxServersPerUser !== undefined) updates.maxServersPerUser = Number(maxServersPerUser);
  if (maxStorageMbPerUser !== undefined) updates.maxStorageMbPerUser = Number(maxStorageMbPerUser);

  // Update credentials if provided and not masked
  if (renderApiKey && !renderApiKey.includes('••••')) updates.renderApiKey = renderApiKey.trim();
  if (renderOwnerId !== undefined) updates.renderOwnerId = renderOwnerId;
  if (r2AccountId !== undefined) updates.r2AccountId = r2AccountId.trim();
  if (r2AccessKeyId !== undefined) updates.r2AccessKeyId = r2AccessKeyId.trim();
  if (r2SecretAccessKey && !r2SecretAccessKey.includes('••••')) updates.r2SecretAccessKey = r2SecretAccessKey.trim();
  if (r2Bucket !== undefined) updates.r2Bucket = r2Bucket.trim();

  const saved = db.updateSettings(updates);

  logActivity({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'admin.settings_update',
    details: 'System settings and credentials updated by administrator',
    ip: req.ip,
  });

  res.json({
    success: true,
    settings: {
      ...saved,
      renderApiKeyMasked: saved.renderApiKey ? `••••••••${saved.renderApiKey.slice(-4)}` : '',
      r2SecretAccessKeyMasked: saved.r2SecretAccessKey ? `••••••••${saved.r2SecretAccessKey.slice(-4)}` : '',
    },
  });
});

// POST /api/v1/admin/test-render - Live Render API connection test
adminRouter.post('/test-render', async (req: AuthenticatedRequest, res) => {
  const { apiKey } = req.body;
  try {
    const result = await renderApi.testConnection(apiKey);
    res.json({
      success: true,
      connected: true,
      owners: result.owners,
      activeOwner: result.activeOwner,
      message: `Successfully connected to Render API! Found ${result.owners.length} workspace(s).`,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      connected: false,
      error: err.message,
    });
  }
});

// POST /api/v1/admin/test-r2 - Live Cloudflare R2 connection test
adminRouter.post('/test-r2', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await r2Storage.testConnection();
    res.json({
      success: true,
      connected: true,
      bucket: result.bucket,
      message: `Successfully connected to Cloudflare R2 bucket: ${result.bucket}`,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      connected: false,
      error: err.message,
    });
  }
});

// POST /api/v1/admin/test-postgres - Live PostgreSQL connection test
adminRouter.post('/test-postgres', async (req: AuthenticatedRequest, res) => {
  const { databaseUrl } = req.body;
  try {
    const result = await postgresService.testConnection(databaseUrl);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
});
