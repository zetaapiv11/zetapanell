import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export class PostgresService {
  private pool: pg.Pool | null = null;
  public isConnected = false;

  constructor() {
    this.initPool();
  }

  private initPool() {
    const dbUrl = process.env['DATABASE_URL'] || config.databaseUrl;
    if (dbUrl && dbUrl.startsWith('postgres')) {
      try {
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        });
        this.testConnection();
      } catch (err) {
        console.error('[PostgreSQL] Failed to initialize pool:', err);
      }
    }
  }

  public async testConnection(connectionString?: string): Promise<{ success: boolean; message: string; version?: string }> {
    const targetPool = connectionString
      ? new Pool({
          connectionString,
          ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
        })
      : this.pool;

    if (!targetPool) {
      return { success: false, message: 'DATABASE_URL not configured.' };
    }

    try {
      const client = await targetPool.connect();
      const res = await client.query('SELECT version()');
      client.release();

      if (!connectionString) {
        this.isConnected = true;
        await this.runAutoMigrations();
      }

      return {
        success: true,
        message: 'Successfully connected to Render PostgreSQL database.',
        version: res.rows[0]?.version,
      };
    } catch (err: any) {
      this.isConnected = false;
      return {
        success: false,
        message: `PostgreSQL connection failed: ${err.message}`,
      };
    }
  }

  public async runAutoMigrations() {
    if (!this.pool) return;
    try {
      const client = await this.pool.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          username VARCHAR(64) UNIQUE NOT NULL,
          email VARCHAR(128) UNIQUE NOT NULL,
          password_hash VARCHAR(256) NOT NULL,
          role VARCHAR(32) NOT NULL DEFAULT 'USER',
          status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
          plan VARCHAR(64) DEFAULT 'NONE',
          max_servers INT NOT NULL DEFAULT 0,
          max_storage_mb INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS servers (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          render_service_id VARCHAR(64) NOT NULL,
          name VARCHAR(128) NOT NULL,
          runtime VARCHAR(32) NOT NULL,
          service_type VARCHAR(32) NOT NULL,
          region VARCHAR(32) NOT NULL,
          plan VARCHAR(32) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'CREATING',
          service_url TEXT,
          repo_url TEXT,
          repo_type VARCHAR(32) NOT NULL DEFAULT 'r2_managed',
          branch VARCHAR(64) NOT NULL DEFAULT 'main',
          build_command TEXT,
          start_command TEXT,
          auto_deploy BOOLEAN DEFAULT true,
          env_vars JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS api_keys (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(128) NOT NULL,
          key_hash VARCHAR(128) NOT NULL,
          key_prefix VARCHAR(32) NOT NULL,
          permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
          last_used_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64),
          username VARCHAR(64),
          server_id VARCHAR(64),
          server_name VARCHAR(128),
          action VARCHAR(64) NOT NULL,
          details TEXT NOT NULL,
          ip VARCHAR(45),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS system_settings (
          id INT PRIMARY KEY DEFAULT 1,
          panel_name VARCHAR(64) DEFAULT 'ZetaPanel',
          render_api_key TEXT,
          render_owner_id VARCHAR(64),
          r2_account_id VARCHAR(64),
          r2_bucket VARCHAR(64) DEFAULT 'zetapanel-servers',
          r2_access_key_id VARCHAR(64),
          r2_secret_access_key TEXT,
          allow_registration BOOLEAN DEFAULT true,
          require_plan_for_servers BOOLEAN DEFAULT true,
          maintenance_mode BOOLEAN DEFAULT false,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        INSERT INTO system_settings (id, panel_name) VALUES (1, 'ZetaPanel')
        ON CONFLICT (id) DO NOTHING;
      `);
      client.release();
      console.log('[PostgreSQL] Database tables initialized on Render PostgreSQL.');
    } catch (err) {
      console.error('[PostgreSQL] Migration error:', err);
    }
  }

  public getPool(): pg.Pool | null {
    return this.pool;
  }
}

export const postgresService = new PostgresService();
