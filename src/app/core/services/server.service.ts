import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RenderDeployItem, ResourceMetrics, ServerItem } from '../models/index.js';
import { AuthService } from './auth.service.js';

@Injectable({
  providedIn: 'root',
})
export class ServerService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private headers() {
    return { headers: this.auth.getAuthHeaders() };
  }

  async getServers(all = false): Promise<ServerItem[]> {
    const url = all ? '/api/v1/servers?all=true' : '/api/v1/servers';
    const res = await firstValueFrom(
      this.http.get<{ object: string; data: ServerItem[] }>(url, this.headers())
    );
    return res.data;
  }

  async getServer(id: string): Promise<ServerItem> {
    const res = await firstValueFrom(
      this.http.get<{ object: string; attributes: ServerItem }>(
        `/api/v1/servers/${id}`,
        this.headers()
      )
    );
    return res.attributes;
  }

  async createServer(payload: Partial<ServerItem> & { initialTemplate?: string }): Promise<ServerItem> {
    const res = await firstValueFrom(
      this.http.post<{ object: string; attributes: ServerItem }>(
        '/api/v1/servers',
        payload,
        this.headers()
      )
    );
    return res.attributes;
  }

  async updateServer(id: string, updates: Partial<ServerItem>): Promise<ServerItem> {
    const res = await firstValueFrom(
      this.http.patch<{ object: string; attributes: ServerItem }>(
        `/api/v1/servers/${id}`,
        updates,
        this.headers()
      )
    );
    return res.attributes;
  }

  async deleteServer(id: string, deleteFiles = false): Promise<void> {
    await firstValueFrom(
      this.http.delete(`/api/v1/servers/${id}?deleteFiles=${deleteFiles}`, this.headers())
    );
  }

  async deploy(id: string, clearCache = false): Promise<RenderDeployItem> {
    const res = await firstValueFrom(
      this.http.post<{ object: string; data: RenderDeployItem }>(
        `/api/v1/servers/${id}/deploy`,
        { clearCache },
        this.headers()
      )
    );
    return res.data;
  }

  async restart(id: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`/api/v1/servers/${id}/restart`, {}, this.headers())
    );
  }

  async suspend(id: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`/api/v1/servers/${id}/suspend`, {}, this.headers())
    );
  }

  async resume(id: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`/api/v1/servers/${id}/resume`, {}, this.headers())
    );
  }

  async getStatus(id: string): Promise<{ status: string; rawStatus: string; serviceUrl?: string }> {
    return await firstValueFrom(
      this.http.get<{ status: string; rawStatus: string; serviceUrl?: string }>(
        `/api/v1/servers/${id}/status`,
        this.headers()
      )
    );
  }

  async getLogs(id: string): Promise<string[]> {
    const res = await firstValueFrom(
      this.http.get<{ logs: string[]; timestamp: string }>(
        `/api/v1/servers/${id}/logs`,
        this.headers()
      )
    );
    return res.logs;
  }

  async getMetrics(id: string, rangeMinutes = 30): Promise<ResourceMetrics> {
    const res = await firstValueFrom(
      this.http.get<{ object: string; data: ResourceMetrics }>(
        `/api/v1/servers/${id}/metrics?rangeMinutes=${rangeMinutes}`,
        this.headers()
      )
    );
    return res.data;
  }

  async getDeploys(id: string): Promise<RenderDeployItem[]> {
    const res = await firstValueFrom(
      this.http.get<{ object: string; data: RenderDeployItem[] }>(
        `/api/v1/servers/${id}/deploys`,
        this.headers()
      )
    );
    return res.data;
  }

  async getEnvVars(id: string): Promise<Array<{ key: string; value: string }>> {
    const res = await firstValueFrom(
      this.http.get<{ object: string; data: Array<{ key: string; value: string }> }>(
        `/api/v1/servers/${id}/env`,
        this.headers()
      )
    );
    return res.data;
  }

  async updateEnvVars(id: string, envVars: Array<{ key: string; value: string }>): Promise<Array<{ key: string; value: string }>> {
    const res = await firstValueFrom(
      this.http.post<{ object: string; data: Array<{ key: string; value: string }> }>(
        `/api/v1/servers/${id}/env`,
        { envVars },
        this.headers()
      )
    );
    return res.data;
  }

  async deleteEnvVar(id: string, key: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`/api/v1/servers/${id}/env/${encodeURIComponent(key)}`, this.headers())
    );
  }

  async execCommand(id: string, command: string): Promise<{ command: string; output: string; exitCode: number }> {
    return await firstValueFrom(
      this.http.post<{ command: string; output: string; exitCode: number }>(
        `/api/v1/servers/${id}/exec`,
        { command },
        this.headers()
      )
    );
  }
}

