import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminOverview, User } from '../models/index.js';
import { AuthService } from './auth.service.js';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private headers() {
    return { headers: this.auth.getAuthHeaders() };
  }

  async getOverview(): Promise<AdminOverview> {
    return await firstValueFrom(
      this.http.get<AdminOverview>('/api/v1/admin/overview', this.headers())
    );
  }

  async getUsers(): Promise<User[]> {
    const res = await firstValueFrom(
      this.http.get<{ object: string; data: User[] }>('/api/v1/admin/users', this.headers())
    );
    return res.data;
  }

  async createUser(payload: {
    username: string;
    email: string;
    password: string;
    role?: string;
    maxServers?: number;
    maxStorageMb?: number;
  }): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<{ object: string; attributes: User }>(
        '/api/v1/admin/users',
        payload,
        this.headers()
      )
    );
    return res.attributes;
  }

  async updateUser(id: string, updates: Partial<User> & { password?: string }): Promise<User> {
    const res = await firstValueFrom(
      this.http.patch<{ object: string; attributes: User }>(
        `/api/v1/admin/users/${id}`,
        updates,
        this.headers()
      )
    );
    return res.attributes;
  }

  async deleteUser(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/v1/admin/users/${id}`, this.headers()));
  }

  async getSettings(): Promise<any> {
    return await firstValueFrom(
      this.http.get<any>('/api/v1/admin/settings', this.headers())
    );
  }

  async updateSettings(settings: any): Promise<any> {
    const res = await firstValueFrom(
      this.http.put<{ success: boolean; settings: any }>(
        '/api/v1/admin/settings',
        settings,
        this.headers()
      )
    );
    return res.settings;
  }

  async testRenderConnection(apiKey?: string): Promise<{ success: boolean; owners: any[]; message: string }> {
    return await firstValueFrom(
      this.http.post<{ success: boolean; owners: any[]; message: string }>(
        '/api/v1/admin/test-render',
        { apiKey },
        this.headers()
      )
    );
  }

  async testR2Connection(): Promise<{ success: boolean; bucket: string; message: string }> {
    return await firstValueFrom(
      this.http.post<{ success: boolean; bucket: string; message: string }>(
        '/api/v1/admin/test-r2',
        {},
        this.headers()
      )
    );
  }
}
