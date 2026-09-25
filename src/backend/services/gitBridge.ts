import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import { r2Storage } from './storage.js';

export class GitBridgeService {
  getRepoPath(serverId: string): string {
    return join(config.reposDir, serverId);
  }

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
