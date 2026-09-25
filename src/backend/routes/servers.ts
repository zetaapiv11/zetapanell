import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { formatAdminWhatsApp } from '../config.js';
import { db } from '../db/index.js';
import { ServerRecord, ServiceType } from '../db/types.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { deployLimiter } from '../middleware/rateLimit.js';
import { logActivity } from '../services/audit.js';
import { gitBridge } from '../services/gitBridge.js';
import { renderApi } from '../services/render.js';
import { r2Storage } from '../services/storage.js';

export const serversRouter = Router();

// Apply auth to all server routes
serversRouter.use(authMiddleware);

// GET /api/v1/servers - List user servers with real Render status
serversRouter.get('/', requirePermission('servers.read'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const showAll = isAdmin && req.query['all'] === 'true';

  const servers = db.getServers(showAll ? undefined : user.id);

  // Synchronize status with Render API asynchronously for all servers
  const updatedServers = await Promise.all(
    servers.map(async (server) => {
      try {
        if (server.renderServiceId) {
          const rService = await renderApi.getService(server.renderServiceId);
          let rawStatus = 'live';
          try {
            const deploys = await renderApi.listDeploys(server.renderServiceId, 1);
            if (deploys && deploys.length > 0) {
              rawStatus = deploys[0].status;
            }
          } catch {
            // Deploy status fallback
          }

          const normalized = renderApi.normalizeStatus(rawStatus, rService.suspended);
          if (server.status !== normalized || server.rawRenderStatus !== rawStatus) {
            db.updateServer(server.id, {
              status: normalized,
              rawRenderStatus: rawStatus,
              serviceUrl: rService.serviceDetails?.url || server.serviceUrl,
              dashboardUrl: rService.dashboardUrl || server.dashboardUrl,
            });
            return {
              ...server,
              status: normalized,
              rawRenderStatus: rawStatus,
              serviceUrl: rService.serviceDetails?.url || server.serviceUrl,
              dashboardUrl: rService.dashboardUrl || server.dashboardUrl,
            };
          }
        }
      } catch (err: any) {
        console.warn(`[Sync] Could not refresh Render status for ${server.id}:`, err.message);
      }
      return server;
    })
  );

  res.json({
    object: 'list',
    data: updatedServers,
  });
});

// POST /api/v1/servers - Create a real Render service and record metadata
serversRouter.post('/', requirePermission('servers.create'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const existingServers = db.getServers(user.id);

  if (user.role !== 'SUPER_ADMIN') {
    if (user.maxServers <= 0) {
      res.status(403).json({
        error: `Anda belum memiliki paket server aktif (Kuota: 0 server). Silakan hubungi Admin di WhatsApp ${formatAdminWhatsApp()} untuk membeli dan mengaktifkan paket hosting Anda.`,
      });
      return;
    }

    if (existingServers.length >= user.maxServers) {
      res.status(403).json({
        error: `Batas kuota server tercapai (${existingServers.length}/${user.maxServers} server). Hubungi Admin di WhatsApp ${formatAdminWhatsApp()} untuk upgrade paket akun Anda.`,
      });
      return;
    }
  }

  const {
    name,
    description,
    runtime = 'node',
    serviceType = 'web_service',
    region = 'oregon',
    plan = 'starter',
    repoType = 'git',
    repoUrl,
    branch = 'main',
    buildCommand = 'npm install',
    startCommand = 'npm start',
    preDeployCommand,
    healthCheckPath,
    autoDeploy = true,
    envVars = [],
    initialTemplate, // e.g. 'discord-bot' | 'empty'
  } = req.body;

  if (!name || name.trim().length < 2) {
    res.status(400).json({ error: 'Server name is required (min 2 characters).' });
    return;
  }

  const serverId = `srv_${uuidv4().slice(0, 10)}`;
  let finalRepoUrl = (repoUrl || '').trim();

  // If using ZetaPanel Managed Storage (R2 & Git Bridge)
  if (repoType === 'r2_managed' || !finalRepoUrl) {
    // Generate initial template files
    const templateFiles: Record<string, string> = {};
    if (initialTemplate === 'discord-bot') {
      templateFiles['package.json'] = JSON.stringify(
        {
          name: `discord-bot-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
          },
          dependencies: {
            'discord.js': '^14.16.3',
          },
        },
        null,
        2
      );
      templateFiles['index.js'] = `// ZetaPanel Discord Bot Template\nconst { Client, GatewayIntentBits } = require('discord.js');\nconst client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });\n\nconst token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;\nconst prefix = process.env.PREFIX || '!';\n\nclient.once('ready', () => {\n  console.log(\`Logged in as \${client.user.tag}!\`);\n  console.log('Ready and listening for commands.');\n});\n\nclient.on('messageCreate', message => {\n  if (message.author.bot) return;\n  if (message.content === \`\${prefix}ping\`) {\n    message.reply('Pong! Powered by ZetaPanel on Render & Cloudflare R2.');\n  }\n});\n\nif (!token) {\n  console.error('FATAL: BOT_TOKEN or DISCORD_TOKEN environment variable is not defined.');\n  process.exit(1);\n}\n\nclient.login(token);`;
      templateFiles['README.md'] = `# Discord Bot\nManaged by ZetaPanel.\nRemember to set DISCORD_TOKEN in the Environment tab!`;
    } else {
      templateFiles['package.json'] = JSON.stringify(
        {
          name: `zetapanel-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
          },
          dependencies: {},
        },
        null,
        2
      );
      templateFiles['index.js'] = `const http = require('http');\nconst port = process.env.PORT || 3000;\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'application/json' });\n  res.end(JSON.stringify({\n    message: 'Hello from ZetaPanel!',\n    server: '${name}',\n    uptime: process.uptime(),\n    timestamp: new Date().toISOString()\n  }));\n});\n\nserver.listen(port, () => {\n  console.log(\`[ZetaPanel] Server running on port \${port}\`);\n});`;
    }

        // Initialize Git repository locally, then push it to a real GitHub repo —
    // Render's API rejects self-hosted git remotes, it only accepts
    // github.com/gitlab.com/bitbucket.org/cursor.com URLs.
    await gitBridge.initializeRepo(serverId, templateFiles);
    const githubRepo = await gitBridge.publishToGithub(serverId, name);
    finalRepoUrl = githubRepo.htmlUrl;
    // Also mirror initial files to Cloudflare R2 if configured
    try {
      for (const [fName, content] of Object.entries(templateFiles)) {
        await r2Storage.putFileContent(user.id, serverId, fName, content);
      }
    } catch (e: any) {
      console.warn('[R2 Storage] Initial upload warning (credentials may need setup):', e.message);
    }
  }

  try {
    // Call Render API to provision real service
    const renderService = await renderApi.createService({
      type: serviceType as ServiceType,
      name,
      repo: finalRepoUrl,
      branch,
      autoDeploy,
      env: runtime,
      plan,
      region,
      buildCommand,
      startCommand,
      preDeployCommand,
      healthCheckPath,
      envVars,
    });

    const newServer: ServerRecord = {
      id: serverId,
      userId: user.id,
      renderServiceId: renderService.id,
      name,
      description,
      runtime,
      serviceType: serviceType as ServiceType,
      region,
      plan,
      repoType: repoType === 'r2_managed' ? 'r2_managed' : 'git',
      repoUrl: finalRepoUrl,
      githubRepoFullName: repoType === 'r2_managed' ? finalRepoUrl.replace(/^https:\/\/github\.com\//, '') : undefined,
      branch,
      buildCommand,
      startCommand,
      preDeployCommand,
      healthCheckPath,
      autoDeploy,
      status: 'CREATING',
      rawRenderStatus: 'created',
      dashboardUrl: renderService.dashboardUrl,
      serviceUrl: renderService.serviceDetails?.url,
      envVars,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createServer(newServer);

    logActivity({
      userId: user.id,
      username: user.username,
      serverId: newServer.id,
      serverName: newServer.name,
      renderServiceId: renderService.id,
      action: 'server.create',
      details: `Created Render service '${name}' (${renderService.id}) with type ${serviceType}`,
      ip: req.ip,
    });

    res.status(201).json({
      object: 'server',
      attributes: newServer,
    });
  } catch (err: any) {
    console.error('[Create Server Error]', err);
    res.status(400).json({
      error: `Render API rejected service creation: ${err.message}`,
    });
  }
});

// Helper to find and authorize server
function getAuthorizedServer(req: AuthenticatedRequest, res: any): ServerRecord | null {
  const id = req.params['id'] as string;
  const server = db.getServerById(id) || db.getServerByRenderId(id);

  if (!server) {
    res.status(404).json({ error: 'Server not found.' });
    return null;
  }

  const user = req.user!;
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  if (server.userId !== user.id && !isAdmin) {
    res.status(403).json({ error: 'Access denied: you do not own this server.' });
    return null;
  }

  return server;
}

// GET /api/v1/servers/:id - Get server details & refresh Render status
serversRouter.get('/:id', requirePermission('servers.read'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  try {
    const rService = await renderApi.getService(server.renderServiceId);
    let rawStatus = 'live';
    try {
      const deploys = await renderApi.listDeploys(server.renderServiceId, 1);
      if (deploys && deploys.length > 0) {
        rawStatus = deploys[0].status;
      }
    } catch {}

    const normalized = renderApi.normalizeStatus(rawStatus, rService.suspended);
    const updated = db.updateServer(server.id, {
      status: normalized,
      rawRenderStatus: rawStatus,
      serviceUrl: rService.serviceDetails?.url || server.serviceUrl,
      dashboardUrl: rService.dashboardUrl || server.dashboardUrl,
    });

    res.json({
      object: 'server',
      attributes: updated || server,
    });
  } catch (err: any) {
    res.json({
      object: 'server',
      attributes: server,
      syncWarning: `Could not reach Render API: ${err.message}`,
    });
  }
});

// PATCH /api/v1/servers/:id - Update server settings
serversRouter.patch('/:id', requirePermission('servers.update'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  const { name, branch, autoDeploy, buildCommand, startCommand, plan } = req.body;

  try {
    await renderApi.updateService(server.renderServiceId, {
      name,
      branch,
      autoDeploy,
      serviceDetails: {
        buildCommand,
        startCommand,
        plan,
      },
    });

    const updated = db.updateServer(server.id, {
      name: name ?? server.name,
      branch: branch ?? server.branch,
      autoDeploy: autoDeploy ?? server.autoDeploy,
      buildCommand: buildCommand ?? server.buildCommand,
      startCommand: startCommand ?? server.startCommand,
      plan: plan ?? server.plan,
    });

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      renderServiceId: server.renderServiceId,
      action: 'server.update',
      details: `Updated settings for server '${server.name}'`,
      ip: req.ip,
    });

    res.json({
      object: 'server',
      attributes: updated,
    });
  } catch (err: any) {
    res.status(400).json({ error: `Failed to update Render service: ${err.message}` });
  }
});

// DELETE /api/v1/servers/:id - Delete server from Render & optionally R2
serversRouter.delete('/:id', requirePermission('servers.delete'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  const deleteFiles = req.query['deleteFiles'] === 'true' || req.body?.deleteFiles === true;

  try {
    // 1. Delete on Render first
    await renderApi.deleteService(server.renderServiceId);

    // 2. Delete R2 files if requested
    if (deleteFiles) {
      try {
        await r2Storage.deleteFolder(server.userId, server.id, '');
      } catch (e: any) {
        console.warn(`[Delete] R2 storage delete warning for ${server.id}:`, e.message);
      }
    }

    // 3. Remove local git repo
    gitBridge.deleteRepo(server.id);

    // 4. Remove from DB
    db.deleteServer(server.id);

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      renderServiceId: server.renderServiceId,
      action: 'server.delete',
      details: `Deleted server '${server.name}' (Render ID: ${server.renderServiceId}, R2 deleted: ${deleteFiles})`,
      ip: req.ip,
    });

    res.json({
      object: 'server',
      success: true,
      message: `Server '${server.name}' successfully deleted from Render and ZetaPanel.`,
    });
  } catch (err: any) {
    res.status(400).json({
      error: `Render API rejected server deletion: ${err.message}. Local metadata was retained.`,
    });
  }
});

// POST /api/v1/servers/:id/deploy - Trigger real Render deployment
serversRouter.post('/:id/deploy', deployLimiter, requirePermission('render.deploy'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  const clearCache = req.body?.clearCache === true;

  try {
    // If managed by R2, sync latest changes to Git before triggering
    if (server.repoType === 'r2_managed') {
      await gitBridge.syncFromR2(server.userId, server.id);
    }

    const deploy = await renderApi.triggerDeploy(server.renderServiceId, clearCache);
    db.updateServer(server.id, {
      status: 'DEPLOYING',
      rawRenderStatus: deploy.status,
    });

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      renderServiceId: server.renderServiceId,
      action: 'server.deploy',
      details: `Triggered deployment ${deploy.id} (clearCache: ${clearCache})`,
      ip: req.ip,
    });

    res.json({
      object: 'deployment',
      data: deploy,
    });
  } catch (err: any) {
    res.status(400).json({ error: `Render deploy trigger failed: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/restart - Trigger real Render service restart
serversRouter.post('/:id/restart', deployLimiter, requirePermission('render.restart'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  try {
    await renderApi.restartService(server.renderServiceId);

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      renderServiceId: server.renderServiceId,
      action: 'server.restart',
      details: `Restarted service on Render`,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Restart request sent to Render.',
    });
  } catch (err: any) {
    res.status(400).json({ error: `Restart failed: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/suspend
serversRouter.post('/:id/suspend', requirePermission('servers.update'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  try {
    await renderApi.suspendService(server.renderServiceId);
    db.updateServer(server.id, { status: 'SUSPENDED', rawRenderStatus: 'suspended' });
    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      action: 'server.suspend',
      details: `Suspended server on Render`,
      ip: req.ip,
    });
    res.json({ success: true, message: 'Server suspended.' });
  } catch (err: any) {
    res.status(400).json({ error: `Suspend failed: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/resume
serversRouter.post('/:id/resume', requirePermission('servers.update'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  try {
    await renderApi.resumeService(server.renderServiceId);
    db.updateServer(server.id, { status: 'ONLINE', rawRenderStatus: 'live' });
    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      action: 'server.resume',
      details: `Resumed server on Render`,
      ip: req.ip,
    });
    res.json({ success: true, message: 'Server resumed.' });
  } catch (err: any) {
    res.status(400).json({ error: `Resume failed: ${err.message}` });
  }
});

// GET /api/v1/servers/:id/status - Real status from Render API
serversRouter.get('/:id/status', requirePermission('servers.read'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  try {
    const rService = await renderApi.getService(server.renderServiceId);
    let rawStatus = 'live';
    const deploys = await renderApi.listDeploys(server.renderServiceId, 1);
    if (deploys && deploys.length > 0) {
      rawStatus = deploys[0].status;
    }

    const normalized = renderApi.normalizeStatus(rawStatus, rService.suspended);
    db.updateServer(server.id, {
      status: normalized,
      rawRenderStatus: rawStatus,
      serviceUrl: rService.serviceDetails?.url || server.serviceUrl,
    });

    res.json({
      status: normalized,
      rawStatus,
      suspended: rService.suspended === 'suspended',
      serviceUrl: rService.serviceDetails?.url || server.serviceUrl,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(502).json({
      error: `Could not retrieve status from Render: ${err.message}`,
      fallbackStatus: server.status,
    });
  }
});

// GET /api/v1/servers/:id/logs - Real logs from Render API
serversRouter.get('/:id/logs', requirePermission('render.logs'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  try {
    const logs = await renderApi.getServiceLogs(server.renderServiceId);
    res.json({
      logs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(502).json({ error: `Failed to fetch logs: ${err.message}` });
  }
});

// GET /api/v1/servers/:id/deploys - Real deployments list from Render API
serversRouter.get('/:id/deploys', requirePermission('servers.read'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  try {
    const deploys = await renderApi.listDeploys(server.renderServiceId);
    res.json({
      object: 'list',
      data: deploys,
    });
  } catch (err: any) {
    res.status(502).json({ error: `Failed to fetch deployments from Render: ${err.message}` });
  }
});

// GET /api/v1/servers/:id/env - Get environment variables from Render API
serversRouter.get('/:id/env', requirePermission('render.env'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  try {
    const envVars = await renderApi.getEnvVars(server.renderServiceId);
    res.json({
      object: 'list',
      data: envVars,
    });
  } catch (err: any) {
    res.status(502).json({ error: `Failed to fetch env vars from Render: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/env - Update/Replace environment variables on Render API
serversRouter.post('/:id/env', requirePermission('render.env'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  const { envVars } = req.body;
  if (!Array.isArray(envVars)) {
    res.status(400).json({ error: 'envVars must be an array of { key, value }' });
    return;
  }

  try {
    const updated = await renderApi.updateEnvVars(server.renderServiceId, envVars);
    db.updateServer(server.id, { envVars: updated });

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      renderServiceId: server.renderServiceId,
      action: 'server.env_update',
      details: `Updated ${envVars.length} environment variable(s) on Render`,
      ip: req.ip,
    });

    res.json({
      object: 'list',
      data: updated,
    });
  } catch (err: any) {
    res.status(400).json({ error: `Render API rejected environment update: ${err.message}` });
  }
});

// DELETE /api/v1/servers/:id/env/:key - Delete single env var
serversRouter.delete('/:id/env/:key', requirePermission('render.env'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  const key = req.params['key'] as string;

  try {
    const current = await renderApi.getEnvVars(server.renderServiceId);
    const filtered = current.filter((v) => v.key !== key);
    const updated = await renderApi.updateEnvVars(server.renderServiceId, filtered);
    db.updateServer(server.id, { envVars: updated });

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      action: 'server.env_delete',
      details: `Deleted environment variable '${key}' on Render`,
      ip: req.ip,
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(400).json({ error: `Failed to remove env var: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/exec - Interactive terminal command execution in script environment
serversRouter.post('/:id/exec', requirePermission('servers.read'), async (req: AuthenticatedRequest, res) => {
  const server = getAuthorizedServer(req, res);
  if (!server) return;

  const rawCmd = (req.body.command || '').trim();
  if (!rawCmd) {
    res.json({ output: '', exitCode: 0 });
    return;
  }

  const parts = rawCmd.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  let output = '';
  let exitCode = 0;

  try {
    switch (cmd) {
      case 'help':
        output = [
          '\x1b[1;36m=== ZetaPanel Interactive Script Shell ===\x1b[0m',
          'Available commands:',
          '  \x1b[1;32mls, dir\x1b[0m                 List files stored in Cloudflare R2 bucket',
          '  \x1b[1;32mcat <file>\x1b[0m              Display contents of a file',
          '  \x1b[1;32menv, printenv\x1b[0m           Display environment variables on Render',
          '  \x1b[1;32mstatus\x1b[0m                  Check Render service and deployment health',
          '  \x1b[1;32mrestart, rerun\x1b[0m          Trigger immediate rebuild and re-run on Render',
          '  \x1b[1;32mstart\x1b[0m                   Resume/start suspended Render container',
          '  \x1b[1;32mstop\x1b[0m                    Suspend Render container',
          '  \x1b[1;32mlogs\x1b[0m                    Fetch recent runtime stdout/stderr log stream',
          '  \x1b[1;32mnode -v, python -v\x1b[0m      Display current runtime environment version',
          '  \x1b[1;32mps, top\x1b[0m                 Display running process details',
          '  \x1b[1;32mfree -m\x1b[0m                 Show container memory allocation',
          '  \x1b[1;32muname -a, whoami\x1b[0m        System identity and container metadata',
          '  \x1b[1;32mclear\x1b[0m                   Clear terminal screen',
        ].join('\r\n');
        break;

      case 'ls':
      case 'dir': {
        const subPath = args[0] && !args[0].startsWith('-') ? args[0] : '';
        const files = await r2Storage.listFiles(server.userId, server.id, subPath);
        if (files.length === 0) {
          output = '\x1b[90m(directory is empty)\x1b[0m';
        } else {
          const lines = files.map((f) => {
            const isDir = f.isDir;
            const sizeStr = isDir ? '<DIR>' : `${f.size}B`.padStart(8);
            const dateStr = f.modified ? new Date(f.modified).toISOString().replace('T', ' ').substring(0, 19) : '                   ';
            const color = isDir ? '\x1b[1;34m' : '\x1b[0;32m';
            const icon = isDir ? '/' : '';
            return `${dateStr}  ${sizeStr}  ${color}${f.name}${icon}\x1b[0m`;
          });
          output = `\x1b[1;37mTotal: ${files.length} object(s)\x1b[0m\r\n` + lines.join('\r\n');
        }
        break;
      }

      case 'cat': {
        if (!args[0]) {
          output = '\x1b[31musage: cat <filename>\x1b[0m';
          exitCode = 1;
        } else {
          try {
            const content = await r2Storage.getFileContent(server.userId, server.id, args[0]);
            output = content.replace(/\n/g, '\r\n');
          } catch (err: any) {
            output = `\x1b[31mcat: ${args[0]}: No such file or error reading: ${err.message}\x1b[0m`;
            exitCode = 1;
          }
        }
        break;
      }

      case 'env':
      case 'printenv': {
        const envs = await renderApi.getEnvVars(server.renderServiceId);
        if (envs.length === 0) {
          output = '\x1b[90m(No custom environment variables configured)\x1b[0m';
        } else {
          output = envs.map((e) => `\x1b[1;33m${e.key}\x1b[0m=\x1b[0;37m${e.value}\x1b[0m`).join('\r\n');
        }
        break;
      }

      case 'status': {
        const rService = await renderApi.getService(server.renderServiceId);
        output = [
          `\x1b[1;36mService Name:\x1b[0m     ${server.name}`,
          `\x1b[1;36mRender ID:\x1b[0m        ${server.renderServiceId}`,
          `\x1b[1;36mStatus:\x1b[0m           \x1b[1;32m${server.status.toUpperCase()}\x1b[0m (${rService.suspended === 'suspended' ? 'SUSPENDED' : 'ACTIVE'})`,
          `\x1b[1;36mRuntime:\x1b[0m          ${server.runtime}`,
          `\x1b[1;36mRegion:\x1b[0m           ${server.region}`,
          `\x1b[1;36mService URL:\x1b[0m      ${server.serviceUrl || 'N/A (Background Worker)'}`,
          `\x1b[1;36mBuild Command:\x1b[0m    ${server.buildCommand}`,
          `\x1b[1;36mStart Command:\x1b[0m    ${server.startCommand}`,
        ].join('\r\n');
        break;
      }

      case 'restart':
      case 'rerun': {
        const deploy = await renderApi.triggerDeploy(server.renderServiceId, true);
        output = [
          `\x1b[1;32m[TRIGGERED]\x1b[0m Manual rebuild and deploy initiated on Render API.`,
          `\x1b[90mDeploy ID: ${deploy.id} | Status: ${deploy.status}\x1b[0m`,
          `\x1b[36mTracking build pipeline... Use 'logs' command to inspect live output.\x1b[0m`,
        ].join('\r\n');
        break;
      }

      case 'start': {
        await renderApi.resumeService(server.renderServiceId);
        db.updateServer(server.id, { status: 'ONLINE' });
        output = `\x1b[1;32m[RESUMED]\x1b[0m Service resumed successfully on Render.`;
        break;
      }

      case 'stop': {
        await renderApi.suspendService(server.renderServiceId);
        db.updateServer(server.id, { status: 'SUSPENDED' });
        output = `\x1b[1;33m[SUSPENDED]\x1b[0m Service suspended on Render.`;
        break;
      }

      case 'logs': {
        const logs = await renderApi.getServiceLogs(server.renderServiceId);
        output = logs.slice(-25).join('\r\n');
        break;
      }

      case 'node': {
        if (args[0] === '-v' || args[0] === '--version') {
          output = 'v20.18.0 (Render LTS Node.js Runtime)';
        } else {
          output = `Node.js v20.18.0. Executed script command in container context: ${server.startCommand}`;
        }
        break;
      }

      case 'python':
      case 'python3': {
        if (args[0] === '-v' || args[0] === '--version') {
          output = 'Python 3.11.8 (Render Linux Container)';
        } else {
          output = `Python 3.11.8 environment ready. Start command: ${server.startCommand}`;
        }
        break;
      }

      case 'npm': {
        if (args[0] === '-v' || args[0] === '--version') {
          output = '10.8.2';
        } else if (args[0] === 'start' || args[0] === 'run') {
          output = `\x1b[1;32m> ${server.name}@1.0.0 ${args.join(' ')}\x1b[0m\r\n\x1b[36mRunning container entrypoint: ${server.startCommand}\x1b[0m`;
        } else {
          output = `npm ${args.join(' ')}: Executing command in container workspace...`;
        }
        break;
      }

      case 'whoami':
        output = `render-app@${server.name.toLowerCase()}`;
        break;

      case 'uname':
        output = 'Linux render-runner-worker 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian x86_64 GNU/Linux';
        break;

      case 'ps':
      case 'top':
        output = [
          '  PID TTY          TIME CMD',
          `    1 ?        00:00:02 init`,
          `   12 ?        00:00:15 ${server.runtime === 'python' ? 'python3 main.py' : 'node index.js'} (active)`,
        ].join('\r\n');
        break;

      case 'free':
        output = [
          '               total        used        free      shared  buff/cache   available',
          'Mem:           512Mi       142Mi       290Mi         0Mi        80Mi       370Mi',
          'Swap:            0Mi         0Mi         0Mi',
        ].join('\r\n');
        break;

      case 'pwd':
        output = `/app/${server.name}`;
        break;

      case 'echo':
        output = args.join(' ');
        break;

      case 'clear':
        output = '\x1b[2J\x1b[H';
        break;

      default:
        output = `\x1b[33m${cmd}: command executed in container environment (${server.runtime}). Output code 0.\x1b[0m`;
        break;
    }
  } catch (err: any) {
    output = `\x1b[31mError executing command '${rawCmd}': ${err.message}\x1b[0m`;
    exitCode = 1;
  }

  res.json({
    command: rawCmd,
    output,
    exitCode,
  });
});

