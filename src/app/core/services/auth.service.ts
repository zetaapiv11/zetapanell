import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/index.js';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private currentUserSignal = signal<User | null>(null);
  private tokenSignal = signal<string | null>(null);
  private isLoadedSignal = signal<boolean>(false);

  readonly user = this.currentUserSignal.asReadonly();
  readonly token = this.tokenSignal.asReadonly();
  readonly isLoaded = this.isLoadedSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());
  readonly isAdmin = computed(() => {
    const role = this.currentUserSignal()?.role;
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  });
  readonly isSuperAdmin = computed(() => this.currentUserSignal()?.role === 'SUPER_ADMIN');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initFromStorage();
    } else {
      this.isLoadedSignal.set(true);
    }
  }

  private async initFromStorage() {
    const savedToken = localStorage.getItem('zp_token');
    if (savedToken) {
      this.tokenSignal.set(savedToken);
      try {
        const res = await firstValueFrom(
          this.http.get<{ user: User }>('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          })
        );
        this.currentUserSignal.set(res.user);
      } catch {
        this.logout(false);
      }
    }
    this.isLoadedSignal.set(true);
  }

  async login(login: string, password: string):Promise<User> {
    const res = await firstValueFrom(
      this.http.post<{ token: string; user: User }>('/api/v1/auth/login', { login, password })
    );

    this.tokenSignal.set(res.token);
    this.currentUserSignal.set(res.user);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('zp_token', res.token);
    }

    return res.user;
  }

  async register(username: string, email: string, password: string): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<{ token: string; user: User }>('/api/v1/auth/register', {
        username,
        email,
        password,
      })
    );

    this.tokenSignal.set(res.token);
    this.currentUserSignal.set(res.user);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('zp_token', res.token);
    }

    return res.user;
  }

  async updateAccount(payload: { email?: string; currentPassword?: string; newPassword?: string }): Promise<User> {
    const res = await firstValueFrom(
      this.http.patch<{ success: boolean; user: User }>(
        '/api/v1/auth/account',
        payload,
        { headers: this.getAuthHeaders() }
      )
    );
    this.currentUserSignal.set(res.user);
    return res.user;
  }

  async refreshUser(): Promise<User | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ user: User }>('/api/v1/auth/me', { headers: this.getAuthHeaders() })
      );
      this.currentUserSignal.set(res.user);
      return res.user;
    } catch {
      return null;
    }
  }

  logout(redirect = true) {
    this.currentUserSignal.set(null);
    this.tokenSignal.set(null);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('zp_token');
    }

    if (redirect) {
      this.router.navigate(['/login']);
    }
  }

  getAuthHeaders(): { [header: string]: string } {
    const token = this.tokenSignal();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
