import { describe, expect, it } from 'vitest';
import { db } from '../src/backend/db/index.js';
import { hashApiKey } from '../src/backend/middleware/auth.js';
import { renderApi } from '../src/backend/services/render.js';

describe('ZetaPanel Core System Tests', () => {
  it('should initialize and seed default super admin', () => {
    const admin = db.getUserByUsername('admin');
    expect(admin).toBeDefined();
    expect(admin?.role).toBe('SUPER_ADMIN');
    expect(admin?.status).toBe('ACTIVE');
  });

  it('should create and verify user accounts with password hashing', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    const testUsername = `testuser_${Date.now()}`;
    const testPassword = 'testPassword123!';

    const passwordHash = await bcrypt.hash(testPassword, 10);
    const user = db.createUser({
      id: `usr_${Date.now()}`,
      username: testUsername,
      email: `${testUsername}@example.com`,
      passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      maxServers: 5,
      maxStorageMb: 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(user.username).toBe(testUsername);
    const isValid = await bcrypt.compare(testPassword, user.passwordHash);
    expect(isValid).toBe(true);

    // Clean up
    db.deleteUser(user.id);
  });

  it('should hash API keys securely with SHA-256', () => {
    const rawKey = 'zp_live_1234567890abcdef1234567890abcdef';
    const hash1 = hashApiKey(rawKey);
    const hash2 = hashApiKey(rawKey);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(rawKey);
    expect(hash1).toHaveLength(64);
  });

  it('should normalize Render API statuses properly', () => {
    expect(renderApi.normalizeStatus('live')).toBe('ONLINE');
    expect(renderApi.normalizeStatus('build_in_progress')).toBe('BUILDING');
    expect(renderApi.normalizeStatus('update_in_progress')).toBe('DEPLOYING');
    expect(renderApi.normalizeStatus('created')).toBe('CREATING');
    expect(renderApi.normalizeStatus('live', 'suspended')).toBe('SUSPENDED');
    expect(renderApi.normalizeStatus('build_failed')).toBe('FAILED');
  });

  it('should store and query activity audit logs', () => {
    const now = new Date().toISOString();
    db.addActivityLog({
      id: `act_test_${Date.now()}`,
      userId: 'usr_admin_0001',
      username: 'admin',
      action: 'server.deploy',
      details: 'Test deploy operation',
      timestamp: now,
    });

    const logs = db.getActivityLogs('usr_admin_0001', 5);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe('server.deploy');
  });

  it('should manage and persist system settings', () => {
    const current = db.getSettings();
    expect(current.panelName).toBeDefined();

    db.updateSettings({ panelName: 'ZetaPanel Pro' });
    expect(db.getSettings().panelName).toBe('ZetaPanel Pro');

    // Restore
    db.updateSettings({ panelName: 'ZetaPanel' });
  });

  it('should support server records and terminal status tracking', () => {
    const serverId = `srv_term_${Date.now()}`;
    const server = db.createServer({
      id: serverId,
      userId: 'usr_admin_0001',
      renderServiceId: 'srv-test-12345',
      name: 'discord-music-bot',
      runtime: 'node',
      serviceType: 'background_worker',
      region: 'oregon',
      plan: 'starter',
      repoType: 'r2_managed',
      repoUrl: '',
      branch: 'main',
      buildCommand: 'npm install',
      startCommand: 'npm start',
      autoDeploy: true,
      status: 'ONLINE',
      envVars: [{ key: 'NODE_ENV', value: 'production' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(server.name).toBe('discord-music-bot');
    expect(server.status).toBe('ONLINE');

    const retrieved = db.getServerById(serverId);
    expect(retrieved?.id).toBe(serverId);
    expect(retrieved?.runtime).toBe('node');

    db.deleteServer(serverId);
    expect(db.getServerById(serverId)).toBeUndefined();
  });
});

