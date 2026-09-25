import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { githubService, GithubRepoInfo } from './github.js';
import { r2Storage } from './storage.js';

export class GitBridgeService {
  getRepoPath(serverId: string): string {
    return join(config.reposDir, serverId);
  }

  /**
   * @deprecated Render no longer accepts self-hosted git remotes for a
   * service's `repo` field (only github.com/gitlab.com/bitbucket.org/
   * cursor.com are accepted) — kept only so the /api/v1/git/:id route still
   * serves something if anyone still has it bookmarked. Use
   * publishToGithub() for anything that actually needs to reach Render.
   */
  getPublicRepoUrl(serverId: string): string {
    const baseUrl = config.appUrl.replace(/\/+$/, '');
    return `${baseUrl}/api/v1/git/${serverId}.git`;
  }

  async initializeRepo(
    serverId: string,
    initialFiles?: Record<string, string>
  ): Promise<void> {
    const repoPath = this.getRepoPath(serverId);
    if (!existsSync(repoPath)) {
      mkdirSync(repoPath, { recursive: true });
    }

    // Default basic files if empty
    const files = initialFiles || {
      'package.json': JSON.stringify(
        {
          name: `zetapanel-service-${serverId}`,
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
          },
          dependencies: {},
        },
        null,
        2
      ),
      'index.js': `// ZetaPanel Managed Service\nconsole.log("Starting server on port", process.env.PORT || 3000);\nrequire('http').createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'application/json' });\n  res.end(JSON.stringify({ status: 'ok', service: '${serverId}', timestamp: new Date() }));\n}).listen(process.env.PORT || 3000);`,
      'README.md': `# ZetaPanel Service\nServer ID: ${serverId}\nManaged via ZetaPanel & Cloudflare R2.`,
    };

    for (const [filename, content] of Object.entries(files)) {
      const fullPath = join(repoPath, filename);
      writeFileSync(fullPath, content, 'utf-8');
    }

    await this.runGitCommand(['init', '-b', 'main'], repoPath);
    await this.runGitCommand(['config', 'user.name', 'ZetaPanel'], repoPath);
    await this.runGitCommand(['config', 'user.email', 'bot@zetapanel.io'], repoPath);
    await this.runGitCommand(['config', 'http.receivepack', 'true'], repoPath);
    await this.runGitCommand(['add', '.'], repoPath);
    await this.runGitCommand(['commit', '-m', 'Initial commit from ZetaPanel'], repoPath);
  }

  /**
   * Creates (idempotent) the GitHub repo for this server, points the local
   * bare working copy's `origin` remote at it, force-pushes `main`, and
   * stores the resulting repo full name on the server record so future
   * pushes (via pushExisting) don't need to hit the create-repo API again.
   * Returns the https://github.com/... URL to hand Render as `repo`.
   */
  async publishToGithub(serverId: string, nameHint: string): Promise<GithubRepoInfo> {
    const repoPath = this.getRepoPath(serverId);
    const info = await githubService.ensureRepo(serverId, nameHint);

    await this.setGithubRemote(repoPath, info.pushUrl);
    await this.runGitCommand(['push', '-f', 'origin', 'main'], repoPath);

    db.updateServer(serverId, { githubRepoFullName: info.fullName });
    return info;
  }

  /**
   * Pushes the current local commit to a GitHub repo already created for
   * this server (via publishToGithub). Used by syncFromR2 after every
   * upload so GitHub — and therefore Render — always mirrors R2's content.
   */
  async pushExisting(serverId: string): Promise<void> {
    const server = db.getServerById(serverId);
    if (!server?.githubRepoFullName) {
      // Never published yet (e.g. server created before this feature, or
      // repoType is 'git' pointing at a user-owned repo) — nothing to push.
      return;
    }
    const repoPath = this.getRepoPath(serverId);
    const pushUrl = githubService.buildPushUrl(server.githubRepoFullName);
    await this.setGithubRemote(repoPath, pushUrl);
    await this.runGitCommand(['push', '-f', 'origin', 'main'], repoPath);
  }

  private async setGithubRemote(repoPath: string, pushUrl: string): Promise<void> {
    try {
      await this.runGitCommand(['remote', 'remove', 'origin'], repoPath);
    } catch {
      // No existing remote — fine.
    }
    await this.runGitCommand(['remote', 'add', 'origin', pushUrl], repoPath);
  }

  async syncFromR2(userId: string, serverId: string): Promise<boolean> {
    try {
      const repoPath = this.getRepoPath(serverId);
      if (!existsSync(repoPath)) {
        mkdirSync(repoPath, { recursive: true });
        await this.runGitCommand(['init', '-b', 'main'], repoPath);
        await this.runGitCommand(['config', 'user.name', 'ZetaPanel'], repoPath);
        await this.runGitCommand(['config', 'user.email', 'bot@zetapanel.io'], repoPath);
      }

      // Download all files from R2 as zip and extract
      const zipBuffer = await r2Storage.compressZip(userId, serverId);
      if (zipBuffer && zipBuffer.length > 0) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(zipBuffer);

        for (const [relPath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const targetFile = join(repoPath, relPath);
          const dir = join(targetFile, '..');
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          const buf = await zipEntry.async('nodebuffer');
          writeFileSync(targetFile, buf);
        }

        await this.runGitCommand(['add', '.'], repoPath);
        try {
          await this.runGitCommand(
            ['commit', '-m', `Sync from Cloudflare R2 at ${new Date().toISOString()}`],
            repoPath
          );
        } catch {
          // Clean working tree, nothing to commit
        }
        try {
          await this.pushExisting(serverId);
        } catch (pushErr) {
          console.warn(`[GitBridge] Push to GitHub failed for ${serverId}:`, pushErr);
        }
        return true;
      }
    } catch (e) {
      console.warn(`[GitBridge] Sync from R2 failed for ${serverId}:`, e);
    }
    return false;
  }

  async commitFiles(serverId: string, message: string): Promise<void> {
    const repoPath = this.getRepoPath(serverId);
    if (!existsSync(repoPath)) {
      await this.initializeRepo(serverId);
      return;
    }
    await this.runGitCommand(['add', '.'], repoPath);
    try {
      await this.runGitCommand(['commit', '-m', message], repoPath);
    } catch {
      // Nothing to commit
    }
  }

  deleteRepo(serverId: string): void {
    const repoPath = this.getRepoPath(serverId);
    if (existsSync(repoPath)) {
      rmSync(repoPath, { recursive: true, force: true });
    }
  }

  private runGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command 'git ${args.join(' ')}' failed (${code}): ${stderr}`));
        }
      });
    });
  }
}

export const gitBridge = new GitBridgeService();
