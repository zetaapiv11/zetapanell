import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FileItem } from '../models/index.js';
import { AuthService } from './auth.service.js';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private headers() {
    return { headers: this.auth.getAuthHeaders() };
  }

  async listFiles(serverId: string, directory = ''): Promise<FileItem[]> {
    const res = await firstValueFrom(
      this.http.get<{ object: string; data: FileItem[]; directory: string }>(
        `/api/v1/servers/${serverId}/files?directory=${encodeURIComponent(directory)}`,
        this.headers()
      )
    );
    return res.data;
  }

  async getFileContent(serverId: string, path: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.get<{ path: string; content: string }>(
        `/api/v1/servers/${serverId}/files/content?path=${encodeURIComponent(path)}`,
        this.headers()
      )
    );
    return res.content;
  }

  async saveFileContent(serverId: string, path: string, content: string): Promise<void> {
    await firstValueFrom(
      this.http.put(
        `/api/v1/servers/${serverId}/files/content`,
        { path, content },
        this.headers()
      )
    );
  }

  async uploadFile(
    serverId: string,
    path: string,
    content: string,
    isBase64 = false,
    extract = false,
    targetDir = ''
  ): Promise<any> {
    return await firstValueFrom(
      this.http.post(
        `/api/v1/servers/${serverId}/files/upload`,
        { path, content, isBase64, extract, targetDir },
        this.headers()
      )
    );
  }

  async deleteFile(serverId: string, path: string, isDir = false): Promise<void> {
    await firstValueFrom(
      this.http.delete(
        `/api/v1/servers/${serverId}/files?path=${encodeURIComponent(path)}&isDir=${isDir}`,
        this.headers()
      )
    );
  }

  async createFolder(serverId: string, path: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `/api/v1/servers/${serverId}/files/folder`,
        { path },
        this.headers()
      )
    );
  }

  async renameFile(serverId: string, oldPath: string, newPath: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `/api/v1/servers/${serverId}/files/rename`,
        { oldPath, newPath },
        this.headers()
      )
    );
  }

  async extractZip(serverId: string, zipPath: string, targetDir = ''): Promise<{ filesExtracted: number }> {
    return await firstValueFrom(
      this.http.post<{ success: boolean; filesExtracted: number }>(
        `/api/v1/servers/${serverId}/files/extract`,
        { zipPath, targetDir },
        this.headers()
      )
    );
  }

  async compressZip(serverId: string, folderPath = '', outputZipName = 'archive.zip'): Promise<any> {
    return await firstValueFrom(
      this.http.post(
        `/api/v1/servers/${serverId}/files/compress`,
        { folderPath, outputZipName },
        this.headers()
      )
    );
  }

  async getDownloadUrl(serverId: string, path: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.get<{ url: string }>(
        `/api/v1/servers/${serverId}/files/download?path=${encodeURIComponent(path)}`,
        this.headers()
      )
    );
    return res.url;
  }

  async syncDeploy(serverId: string): Promise<any> {
    return await firstValueFrom(
      this.http.post(`/api/v1/servers/${serverId}/files/sync-deploy`, {}, this.headers())
    );
  }
}
