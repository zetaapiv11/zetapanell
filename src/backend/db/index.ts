import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import {
  ActivityLogRecord,
  ApiKeyRecord,
  ServerRecord,
  SystemSettings,
  User,
} from './types.js';

interface DatabaseSchema {
  users: User[];
  servers: ServerRecord[];
  apiKeys: ApiKeyRecord[];
  activityLogs: ActivityLogRecord[];
  settings: SystemSettings;
}

const DEFAULT_SETTINGS: SystemSettings = {
  panelName: 'ZetaPanel',
  panelUrl: config.appUrl,
  allowRegistration: true,
  maintenanceMode: false,
  defaultRegion: 'oregon',
  defaultRuntime: 'node',
  defaultPlan: 'starter',
  maxServersPerUser: 5,
  maxStorageMbPerUser: 1024,
  maxUploadSizeBytes: 100 * 1024 * 1024, // 100MB
  renderApiKey: config.renderApiKey,
  renderOwnerId: config.renderOwnerId,
  renderOwnerName: '',
  r2AccountId: config.r2AccountId,
  r2AccessKeyId: config.r2AccessKeyId,
  r2SecretAccessKey: config.r2SecretAccessKey,
  r2Bucket: config.r2Bucket,
  githubToken: config.githubToken,
  githubOwner: config.githubOwner,
  githubOwnerType: config.githubOwnerType,
  githubVisibility: config.githubVisibility,
};

class Database {
  private filePath: string;
  private data: DatabaseSchema;

  constructor() {
    this.filePath = join(config.dataDir, 'zetapanel.db.json');
    try {
      this.ensureDirs();
    } catch (e) {
      // During the Angular SSR build's route-extraction step, this module is
      // imported and instantiated before the persistent disk (/data) is
      // actually mounted (disks only attach at runtime, not build time), so
      // mkdir can fail here. Swallow it so the build doesn't crash — at real
      // runtime the disk exists and this succeeds normally.
      console.warn('[DB] ensureDirs failed (expected during build if DATA_DIR is not yet mounted):', e);
    }
    this.data = this.loadData();
    this.seedDefaultAdmin();
  }

  private ensureDirs() {
    if (!existsSync(config.dataDir)) {
      mkdirSync(config.dataDir, { recursive: true });
    }
    if (!existsSync(config.reposDir)) {
      mkdirSync(config.reposDir, { recursive: true });
    }
    if (!existsSync(config.uploadsDir)) {
      mkdirSync(config.uploadsDir, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || [],
          servers: parsed.servers || [],
          apiKeys: parsed.apiKeys || [],
          activityLogs: parsed.activityLogs || [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        };
      }
    } catch (e) {
      console.error('[DB] Error loading database file, initializing defaults:', e);
    }

    return {
      users: [],
      servers: [],
      apiKeys: [],
      activityLogs: [],
      settings: { ...DEFAULT_SETTINGS },
    };
  }

  private save() {
    try {
      this.ensureDirs();
      const tempPath = `${this.filePath}.tmp`;
      writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to persist database:', err);
    }
  }

  private seedDefaultAdmin() {
    const existing = this.data.users.find(
      (u) => u.username === 'admin' || u.email === 'admin@zetapanel.io'
    );
    if (!existing) {
      const passwordHash = bcrypt.hashSync('admin123', 10);
      const adminUser: User = {
        id: 'usr_admin_0001',
        username: 'admin',
        email: 'admin@zetapanel.io',
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        maxServers: 50,
        maxStorageMb: 10240,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.users.push(adminUser);
      this.save();
      console.log('[DB] Seeded default Super Admin user: admin / admin123');
    }
  }

  // --- Users ---
  getUsers(): User[] {
    return [...this.data.users];
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserByUsername(username: string): User | undefined {
    return this.data.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.users[idx];
  }

  deleteUser(id: string): boolean {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.data.users.splice(idx, 1);
    // Also remove associated servers, api keys, logs
    this.data.servers = this.data.servers.filter((s) => s.userId !== id);
    this.data.apiKeys = this.data.apiKeys.filter((k) => k.userId !== id);
    this.save();
    return true;
  }

  // --- Servers ---
  getServers(userId?: string): ServerRecord[] {
    if (userId) {
      return this.data.servers.filter((s) => s.userId === userId);
    }
    return [...this.data.servers];
  }

  getServerById(id: string): ServerRecord | undefined {
    return this.data.servers.find((s) => s.id === id);
  }

  getServerByRenderId(renderId: string): ServerRecord | undefined {
    return this.data.servers.find((s) => s.renderServiceId === renderId);
  }

  createServer(server: ServerRecord): ServerRecord {
    this.data.servers.push(server);
    this.save();
    return server;
  }

  updateServer(id: string, updates: Partial<ServerRecord>): ServerRecord | undefined {
    const idx = this.data.servers.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;
    this.data.servers[idx] = {
      ...this.data.servers[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.servers[idx];
  }

  deleteServer(id: string): boolean {
    const idx = this.data.servers.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.data.servers.splice(idx, 1);
    this.save();
    return true;
  }

  // --- API Keys ---
  getApiKeys(userId?: string): ApiKeyRecord[] {
    if (userId) {
      return this.data.apiKeys.filter((k) => k.userId === userId);
    }
    return [...this.data.apiKeys];
  }

  getApiKeyById(id: string): ApiKeyRecord | undefined {
    return this.data.apiKeys.find((k) => k.id === id);
  }

  createApiKey(record: ApiKeyRecord): ApiKeyRecord {
    this.data.apiKeys.push(record);
    this.save();
    return record;
  }

  deleteApiKey(id: string, userId?: string): boolean {
    const idx = this.data.apiKeys.findIndex(
      (k) => k.id === id && (!userId || k.userId === userId)
    );
    if (idx === -1) return false;
    this.data.apiKeys.splice(idx, 1);
    this.save();
    return true;
  }

  touchApiKey(id: string): void {
    const key = this.data.apiKeys.find((k) => k.id === id);
    if (key) {
      key.lastUsedAt = new Date().toISOString();
      this.save();
    }
  }

  // --- Activity Logs ---
  getActivityLogs(userId?: string, limit = 50): ActivityLogRecord[] {
    let logs = this.data.activityLogs;
    if (userId) {
      logs = logs.filter((l) => l.userId === userId);
    }
    return [...logs].reverse().slice(0, limit);
  }

  getServerActivityLogs(serverId: string, limit = 50): ActivityLogRecord[] {
    return this.data.activityLogs
      .filter((l) => l.serverId === serverId)
      .reverse()
      .slice(0, limit);
  }

  addActivityLog(log: ActivityLogRecord): void {
    this.data.activityLogs.push(log);
    // Keep max 2000 logs in memory/disk
    if (this.data.activityLogs.length > 2000) {
      this.data.activityLogs = this.data.activityLogs.slice(-2000);
    }
    this.save();
  }

  // --- Settings ---
  getSettings(): SystemSettings {
    return { ...this.data.settings };
  }

  updateSettings(updates: Partial<SystemSettings>): SystemSettings {
    this.data.settings = {
      ...this.data.settings,
      ...updates,
    };
    this.save();
    return { ...this.data.settings };
  }
}

export const db = new Database();
