import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiKeyItem } from '../models/index.js';
import { AuthService } from './auth.service.js';

@Injectable({
  providedIn: 'root',
})
export class ApiKeyService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private headers() {
    return { headers: this.auth.getAuthHeaders() };
  }

  async getApiKeys(): Promise<ApiKeyItem[]> {
    const res = await firstValueFrom(
      this.http.get<{ object: string; data: ApiKeyItem[] }>('/api/v1/api-keys', this.headers())
    );
    return res.data;
  }

  async createApiKey(name: string, permissions: string[]): Promise<ApiKeyItem & { secretToken: string }> {
    const res = await firstValueFrom(
      this.http.post<ApiKeyItem & { secretToken: string }>(
        '/api/v1/api-keys',
        { name, permissions },
        this.headers()
      )
    );
    return res;
  }

  async deleteApiKey(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/v1/api-keys/${id}`, this.headers()));
  }
}
