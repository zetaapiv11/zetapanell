import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Router } from 'express';
import { gitBridge } from '../services/gitBridge.js';

export const gitRouter = Router();

// Git info/refs handler for smart HTTP
gitRouter.get('/:repo/info/refs', async (req, res) => {
  const repoParam = (req.params['repo'] as string) || '';
  const serverId = repoParam.replace(/\.git$/, '');
  const service = req.query['service'] as string;
  const repoPath = gitBridge.getRepoPath(serverId);

  if (!existsSync(repoPath)) {
    // If not existing yet, initialize basic repo
    await gitBridge.initializeRepo(serverId);
  }

  if (service !== 'git-upload-pack') {
    res.status(400).send('Only git-upload-pack is supported for deployment');
    return;
  }

  res.setHeader('Content-Type', `application/x-${service}-advertisement`);
  res.setHeader('Cache-Control', 'no-cache');

  // Git protocol requires a packet-line with service name: # service=git-upload-pack\n0000
  const header = `# service=${service}\n`;
  const len = (header.length + 4).toString(16).padStart(4, '0');
  res.write(`${len}${header}0000`);

  const proc = spawn('git', ['upload-pack', '--stateless-rpc', '--advertise-refs', repoPath]);
  proc.stdout.pipe(res);
  proc.stderr.on('data', (d) => console.error('[Git info/refs stderr]', d.toString()));
});

// Git upload-pack handler for clone/fetch
gitRouter.post('/:repo/git-upload-pack', async (req, res) => {
  const repoParam = (req.params['repo'] as string) || '';
  const serverId = repoParam.replace(/\.git$/, '');
  const repoPath = gitBridge.getRepoPath(serverId);

  if (!existsSync(repoPath)) {
    await gitBridge.initializeRepo(serverId);
  }

  res.setHeader('Content-Type', 'application/x-git-upload-pack-result');
  res.setHeader('Cache-Control', 'no-cache');

  const proc = spawn('git', ['upload-pack', '--stateless-rpc', repoPath]);
  req.pipe(proc.stdin);
  proc.stdout.pipe(res);
  proc.stderr.on('data', (d) => console.error('[Git upload-pack stderr]', d.toString()));
});

// Direct tarball or zip endpoint for Render or manual download
gitRouter.get('/:repo/archive.tar.gz', (req, res) => {
  const repoParam = (req.params['repo'] as string) || '';
  const serverId = repoParam.replace(/\.git$/, '');
  const repoPath = gitBridge.getRepoPath(serverId);
  if (!existsSync(repoPath)) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }

  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${serverId}.tar.gz"`);

  const proc = spawn('git', ['archive', '--format=tar.gz', 'main'], { cwd: repoPath });
  proc.stdout.pipe(res);
});
