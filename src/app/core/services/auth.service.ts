import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/index.js';

export interface PendingRegistration {
  pendingVerification: true;
  registrationId: string;
  email: string;
  resendAfterSeconds: number;
  expiresInSeconds: number;
}

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

  private startSession(res: { token: string; user: User }): User {
    this.tokenSignal.set(res.token);
    this.currentUserSignal.set(res.user);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('zp_token', res.token);
    }

    return res.user;
  }

  async login(login: string, password: string): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<{ token: string; user: User }>('/api/v1/auth/login', { login, password })
    );
    return this.startSession(res);
  }

  /**
   * Step 1 of sign-up: validates the details and emails a 6-digit code. No
   * account (or session) exists until verifyRegistration() succeeds.
   */
  async register(username: string, email: string, password: string): Promise<PendingRegistration> {
    return firstValueFrom(
      this.http.post<PendingRegistration>('/api/v1/auth/register', { username, email, password })
    );
  }

  /** Step 2 of sign-up: confirms the emailed code, creates the account and logs in. */
  async verifyRegistration(registrationId: string, code: string): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<{ token: string; user: User }>('/api/v1/auth/register/verify', {
        registrationId,
        code,
      })
    );
    return this.startSession(res);
  }

  async resendRegistrationCode(registrationId: string): Promise<{ resendAfterSeconds: number }> {
    return firstValueFrom(
      this.http.post<{ resendAfterSeconds: number }>('/api/v1/auth/register/resend', {
        registrationId,
      })
    );
  }

  /** Emails a reset code if the address belongs to an account (response is identical either way). */
  async forgotPassword(email: string): Promise<{ resendAfterSeconds: number }> {
    return firstValueFrom(
      this.http.post<{ resendAfterSeconds: number }>('/api/v1/auth/forgot-password', { email })
    );
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post('/api/v1/auth/reset-password', { email, code, newPassword })
    );
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
