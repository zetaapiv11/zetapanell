import { Router } from 'express';
import { db } from '../db/index.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { logActivity } from '../services/audit.js';
import { gitBridge } from '../services/gitBridge.js';
import { renderApi } from '../services/render.js';
import { r2Storage } from '../services/storage.js';

export const filesRouter = Router();

filesRouter.use(authMiddleware);

// Helper for server authorization
function checkServerAccess(req: AuthenticatedRequest, res: any) {
  const id = req.params['id'] as string;
  const server = db.getServerById(id) || db.getServerByRenderId(id);
  if (!server) {
    res.status(404).json({ error: 'Server not found.' });
    return null;
  }
  const user = req.user!;
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  if (server.userId !== user.id && !isAdmin) {
    res.status(403).json({ error: 'Access denied.' });
    return null;
  }
  return server;
}

// GET /api/v1/servers/:id/files - List files from Cloudflare R2
filesRouter.get('/:id/files', requirePermission('files.read'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const directory = (req.query['directory'] as string) || '';

  try {
    const files = await r2Storage.listFiles(server.userId, server.id, directory);
    res.json({
      object: 'list',
      data: files,
      directory,
    });
  } catch (err: any) {
    res.status(502).json({
      error: `Cloudflare R2 storage error: ${err.message}`,
    });
  }
});

// GET /api/v1/servers/:id/files/content - Read text file from R2
filesRouter.get('/:id/files/content', requirePermission('files.read'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const filePath = req.query['path'] as string;
  if (!filePath) {
    res.status(400).json({ error: 'Query parameter "path" is required.' });
    return;
  }

  try {
    const content = await r2Storage.getFileContent(server.userId, server.id, filePath);
    res.json({
      path: filePath,
      content,
    });
  } catch (err: any) {
    res.status(404).json({ error: `File not found or unreadable: ${err.message}` });
  }
});

// PUT /api/v1/servers/:id/files/content - Save text file in R2
filesRouter.put('/:id/files/content', requirePermission('files.write'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const { path, content } = req.body;
  if (!path || content === undefined) {
    res.status(400).json({ error: 'File path and content are required.' });
    return;
  }

  try {
    await r2Storage.putFileContent(server.userId, server.id, path, content);

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      action: 'file.edit',
      details: `Saved file '${path}' to Cloudflare R2`,
      ip: req.ip,
    });

    res.json({ success: true, path });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to save file: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/files/upload - Upload file (buffer or base64) to R2
filesRouter.post('/:id/files/upload', requirePermission('files.write'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const { path, content, isBase64, isZipExtract } = req.body;
  if (!path || !content) {
    res.status(400).json({ error: 'Path and content payload are required.' });
    return;
  }

  try {
    const buffer = isBase64 ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf-8');

    if (isZipExtract || path.endsWith('.zip') && req.body.extract === true) {
      const result = await r2Storage.extractZip(server.userId, server.id, buffer, req.body.targetDir || '');
      logActivity({
        userId: req.user!.id,
        username: req.user!.username,
        serverId: server.id,
        serverName: server.name,
        action: 'file.extract',
        details: `Uploaded & extracted zip (${result.filesCount} files) into R2`,
        ip: req.ip,
      });
      res.json({ success: true, filesExtracted: result.filesCount });
      return;
    }

    await r2Storage.putFileContent(server.userId, server.id, path, buffer);

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      action: 'file.upload',
      details: `Uploaded '${path}' (${buffer.length} bytes) to Cloudflare R2`,
      ip: req.ip,
    });

    res.json({ success: true, path, size: buffer.length });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to upload to Cloudflare R2: ${err.message}` });
  }
});

// DELETE /api/v1/servers/:id/files - Delete file or directory in R2
filesRouter.delete('/:id/files', requirePermission('files.delete'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const path = (req.query['path'] as string) || req.body?.path;
  const isDir = req.query['isDir'] === 'true' || req.body?.isDir === true;

  if (!path) {
    res.status(400).json({ error: 'File/directory path is required.' });
    return;
  }

  try {
    if (isDir) {
      await r2Storage.deleteFolder(server.userId, server.id, path);
    } else {
      await r2Storage.deleteFile(server.userId, server.id, path);
    }

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      action: 'file.delete',
      details: `Deleted ${isDir ? 'directory' : 'file'} '${path}' from Cloudflare R2`,
      ip: req.ip,
    });

    res.json({ success: true, path });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to delete from R2: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/files/folder - Create folder in R2
filesRouter.post('/:id/files/folder', requirePermission('files.write'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const { path } = req.body;
  if (!path) {
    res.status(400).json({ error: 'Folder path is required.' });
    return;
  }

  try {
    await r2Storage.createFolder(server.userId, server.id, path);
    res.json({ success: true, path });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to create folder in R2: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/files/rename - Rename file in R2
filesRouter.post('/:id/files/rename', requirePermission('files.write'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) {
    res.status(400).json({ error: 'Both oldPath and newPath are required.' });
    return;
  }

  try {
    await r2Storage.renameFile(server.userId, server.id, oldPath, newPath);
    res.json({ success: true, oldPath, newPath });
  } catch (err: any) {
    res.status(500).json({ error: `Rename failed in R2: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/files/extract - Extract an existing zip in R2
filesRouter.post('/:id/files/extract', requirePermission('files.extract'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const { zipPath, targetDir = '' } = req.body;
  if (!zipPath) {
    res.status(400).json({ error: 'zipPath is required.' });
    return;
  }

  try {
    const { client, bucket } = (r2Storage as any).getClient();
    const key = `users/${server.userId}/servers/${server.id}/files/${zipPath.replace(/^\/+/, '')}`;
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await obj.Body.transformToByteArray();

    const result = await r2Storage.extractZip(server.userId, server.id, Buffer.from(bytes), targetDir);

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      action: 'file.extract',
      details: `Extracted '${zipPath}' into '${targetDir || '/'}' (${result.filesCount} files)`,
      ip: req.ip,
    });

    res.json({ success: true, filesExtracted: result.filesCount });
  } catch (err: any) {
    res.status(500).json({ error: `ZIP Extraction failed: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/files/compress - Compress files in R2 to ZIP
filesRouter.post('/:id/files/compress', requirePermission('files.compress'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const { folderPath = '', outputZipName = 'archive.zip' } = req.body;

  try {
    const zipBuffer = await r2Storage.compressZip(server.userId, server.id, folderPath);
    await r2Storage.putFileContent(server.userId, server.id, outputZipName, zipBuffer, 'application/zip');

    logActivity({
      userId: req.user!.id,
      username: req.user!.username,
      serverId: server.id,
      serverName: server.name,
      action: 'file.compress',
      details: `Compressed folder '${folderPath}' to '${outputZipName}' in R2`,
      ip: req.ip,
    });

    res.json({ success: true, outputZipName, size: zipBuffer.length });
  } catch (err: any) {
    res.status(500).json({ error: `Compression failed: ${err.message}` });
  }
});

// GET /api/v1/servers/:id/files/download - Download file or presigned URL
filesRouter.get('/:id/files/download', requirePermission('files.read'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const filePath = req.query['path'] as string;
  if (!filePath) {
    res.status(400).json({ error: 'path is required.' });
    return;
  }

  try {
    const presignedUrl = await r2Storage.getPresignedDownloadUrl(server.userId, server.id, filePath, 300);
    res.json({ url: presignedUrl });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to generate download URL: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/files/presigned-upload - Presigned URL for direct large upload to R2
filesRouter.post('/:id/files/presigned-upload', requirePermission('files.write'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  const { path } = req.body;
  if (!path) {
    res.status(400).json({ error: 'File path is required.' });
    return;
  }

  try {
    const uploadUrl = await r2Storage.getPresignedUploadUrl(server.userId, server.id, path, 900);
    res.json({ url: uploadUrl, path });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to create presigned upload URL: ${err.message}` });
  }
});

// POST /api/v1/servers/:id/files/sync-deploy - Syncs R2 files into git bridge and triggers deploy on Render
filesRouter.post('/:id/files/sync-deploy', requirePermission('render.deploy'), async (req: AuthenticatedRequest, res) => {
  const server = checkServerAccess(req, res);
  if (!server) return;

  try {
    // 1. Sync from R2 to Git Bridge
    await gitBridge.syncFromR2(server.userId, server.id);

    // 2. Trigger deploy on Render
    const deploy = await renderApi.triggerDeploy(server.renderServiceId, true);
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
      action: 'server.sync_deploy',
      details: `Synced R2 files to Git Bridge and triggered Render deploy ${deploy.id}`,
      ip: req.ip,
    });

    res.json({
      success: true,
      deploy,
      message: 'Files synchronized from Cloudflare R2. Deployment initiated on Render.',
    });
  } catch (err: any) {
    res.status(500).json({ error: `Sync and deploy failed: ${err.message}` });
  }
});
