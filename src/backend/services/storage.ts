import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import JSZip from 'jszip';
import { db } from '../db/index.js';

export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: string;
}

export class R2StorageService {
  private getClient(): { client: S3Client; bucket: string } {
    const settings = db.getSettings();
    const accountId = settings.r2AccountId || process.env['R2_ACCOUNT_ID'] || '';
    const accessKeyId = settings.r2AccessKeyId || process.env['R2_ACCESS_KEY_ID'] || '';
    const secretAccessKey = settings.r2SecretAccessKey || process.env['R2_SECRET_ACCESS_KEY'] || '';
    const bucket = settings.r2Bucket || process.env['R2_BUCKET'] || 'zetapanel-servers';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Cloudflare R2 is not fully configured. Please configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in Settings.'
      );
    }

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return { client, bucket };
  }

  getPrefix(userId: string, serverId: string, subPath = ''): string {
    const cleanSubPath = subPath.replace(/^\/+|\/+$/g, '');
    let base = `users/${userId}/servers/${serverId}/files/`;
    if (cleanSubPath) {
      base += `${cleanSubPath}/`;
    }
    return base;
  }

  async testConnection(): Promise<{ connected: boolean; bucket: string }> {
    const { client, bucket } = this.getClient();
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { connected: true, bucket };
  }

  async listFiles(userId: string, serverId: string, directory = ''): Promise<FileItem[]> {
    const { client, bucket } = this.getClient();
    const cleanDir = directory.replace(/^\/+|\/+$/g, '');
    const prefix = cleanDir
      ? `users/${userId}/servers/${serverId}/files/${cleanDir}/`
      : `users/${userId}/servers/${serverId}/files/`;

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/',
    });

    const response = await client.send(command);
    const items: FileItem[] = [];

    // Directories (CommonPrefixes)
    if (response.CommonPrefixes) {
      for (const cp of response.CommonPrefixes) {
        if (!cp.Prefix) continue;
        const dirName = cp.Prefix.slice(prefix.length).replace(/\/+$/, '');
        if (!dirName) continue;
        const relPath = cleanDir ? `${cleanDir}/${dirName}` : dirName;
        items.push({
          name: dirName,
          path: relPath,
          isDir: true,
          size: 0,
          modified: new Date().toISOString(),
        });
      }
    }

    // Files (Contents)
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key) continue;
        // Skip directory placeholder keys ending in /
        if (obj.Key === prefix || obj.Key.endsWith('/')) continue;

        const fileName = obj.Key.slice(prefix.length);
        if (!fileName || fileName.includes('/')) continue; // In subfolder

        const relPath = cleanDir ? `${cleanDir}/${fileName}` : fileName;
        items.push({
          name: fileName,
          path: relPath,
          isDir: false,
          size: obj.Size || 0,
          modified: obj.LastModified ? obj.LastModified.toISOString() : new Date().toISOString(),
        });
      }
    }

    // Sort: directories first, then alphabetical
    return items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async getFileContent(userId: string, serverId: string, filePath: string): Promise<string> {
    const { client, bucket } = this.getClient();
    const cleanPath = filePath.replace(/^\/+/, '');
    const key = `users/${userId}/servers/${serverId}/files/${cleanPath}`;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);
    if (!response.Body) {
      return '';
    }

    return await response.Body.transformToString('utf-8');
  }

  async putFileContent(
    userId: string,
    serverId: string,
    filePath: string,
    content: string | Buffer,
    contentType = 'text/plain'
  ): Promise<void> {
    const { client, bucket } = this.getClient();
    const cleanPath = filePath.replace(/^\/+/, '');
    const key = `users/${userId}/servers/${serverId}/files/${cleanPath}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: typeof content === 'string' ? Buffer.from(content, 'utf-8') : content,
      ContentType: contentType,
    });

    await client.send(command);
  }

  async createFolder(userId: string, serverId: string, folderPath: string): Promise<void> {
    const { client, bucket } = this.getClient();
    const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
    const key = `users/${userId}/servers/${serverId}/files/${cleanPath}/.keep`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from('', 'utf-8'),
      ContentType: 'application/x-directory',
    });

    await client.send(command);
  }

  async deleteFile(userId: string, serverId: string, filePath: string): Promise<void> {
    const { client, bucket } = this.getClient();
    const cleanPath = filePath.replace(/^\/+/, '');
    const key = `users/${userId}/servers/${serverId}/files/${cleanPath}`;

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  }

  async deleteFolder(userId: string, serverId: string, folderPath: string): Promise<void> {
    const { client, bucket } = this.getClient();
    const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
    const prefix = cleanFolder
      ? `users/${userId}/servers/${serverId}/files/${cleanFolder}/`
      : `users/${userId}/servers/${serverId}/files/`;

    let continuationToken: string | undefined = undefined;
    do {
      const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listResponse = await client.send(listCommand);
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        const objectsToDelete = listResponse.Contents.map((c) => ({ Key: c.Key! }));
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objectsToDelete },
          })
        );
      }
      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);
  }

  async renameFile(
    userId: string,
    serverId: string,
    oldPath: string,
    newPath: string
  ): Promise<void> {
    const { client, bucket } = this.getClient();
    const cleanOld = oldPath.replace(/^\/+/, '');
    const cleanNew = newPath.replace(/^\/+/, '');

    const oldKey = `users/${userId}/servers/${serverId}/files/${cleanOld}`;
    const newKey = `users/${userId}/servers/${serverId}/files/${cleanNew}`;

    // Read old object
    const getRes = await client.send(new GetObjectCommand({ Bucket: bucket, Key: oldKey }));
    const bytes = await getRes.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Original file not found: ${oldPath}`);
    }

    // Write to new key
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: newKey,
        Body: Buffer.from(bytes),
        ContentType: getRes.ContentType || 'application/octet-stream',
      })
    );

    // Delete old key
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
  }

  async extractZip(
    userId: string,
    serverId: string,
    zipBuffer: Buffer,
    targetDirectory = ''
  ): Promise<{ filesCount: number }> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const { client, bucket } = this.getClient();
    const cleanDir = targetDirectory.replace(/^\/+|\/+$/g, '');
    let count = 0;

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      const fileData = await zipEntry.async('nodebuffer');
      const finalRelPath = cleanDir ? `${cleanDir}/${relativePath}` : relativePath;
      const key = `users/${userId}/servers/${serverId}/files/${finalRelPath.replace(/^\/+/, '')}`;

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fileData,
          ContentType: this.guessContentType(relativePath),
        })
      );
      count++;
    }

    return { filesCount: count };
  }

  async compressZip(
    userId: string,
    serverId: string,
    folderPath = ''
  ): Promise<Buffer> {
    const { client, bucket } = this.getClient();
    const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
    const basePrefix = `users/${userId}/servers/${serverId}/files/`;
    const prefix = cleanFolder ? `${basePrefix}${cleanFolder}/` : basePrefix;

    const zip = new JSZip();
    let continuationToken: string | undefined;

    do {
      const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listResponse = await client.send(listCommand);
      if (listResponse.Contents) {
        for (const item of listResponse.Contents) {
          if (!item.Key || item.Key.endsWith('/')) continue;
          const getCommand = new GetObjectCommand({
            Bucket: bucket,
            Key: item.Key,
          });
          const obj = await client.send(getCommand);
          const data = await obj.Body?.transformToByteArray();
          if (data) {
            const relInZip = item.Key.slice(prefix.length);
            zip.file(relInZip, Buffer.from(data));
          }
        }
      }
      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  async getPresignedUploadUrl(
    userId: string,
    serverId: string,
    filePath: string,
    expiresIn = 900
  ): Promise<string> {
    const { client, bucket } = this.getClient();
    const cleanPath = filePath.replace(/^\/+/, '');
    const key = `users/${userId}/servers/${serverId}/files/${cleanPath}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await getSignedUrl(client, command, { expiresIn });
  }

  async getPresignedDownloadUrl(
    userId: string,
    serverId: string,
    filePath: string,
    expiresIn = 900
  ): Promise<string> {
    const { client, bucket } = this.getClient();
    const cleanPath = filePath.replace(/^\/+/, '');
    const key = `users/${userId}/servers/${serverId}/files/${cleanPath}`;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await getSignedUrl(client, command, { expiresIn });
  }

  private guessContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json':
        return 'application/json';
      case 'js':
      case 'mjs':
        return 'application/javascript';
      case 'ts':
        return 'application/typescript';
      case 'html':
        return 'text/html';
      case 'css':
        return 'text/css';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'svg':
        return 'image/svg+xml';
      case 'zip':
        return 'application/zip';
      case 'md':
      case 'txt':
      case 'env':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }
}

export const r2Storage = new R2StorageService();
