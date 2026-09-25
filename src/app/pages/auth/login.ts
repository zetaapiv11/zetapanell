import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service.js';
import { PlatformConfigService } from '../../core/services/platform-config.service.js';
import { ToastService } from '../../core/services/toast.service.js';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule, RouterLink],
  template: `
    <div class="min-h-screen bg-neutral-950 flex flex-col justify-center items-center px-4 py-12 font-sans selection:bg-emerald-500 selection:text-white">
      <div class="w-full max-w-md">
        <!-- Logo & Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xl mb-3 shadow-inner">
            Z
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-white">ZetaPanel</h1>
          <p class="text-xs text-neutral-400 mt-1">Infrastructure Control Panel powered by Render &amp; Cloudflare R2</p>
        </div>

        <!-- Pricing Teaser (shown before Sign In / Create Account) -->
        <div class="mb-6 p-4 rounded-2xl border border-emerald-800/60 bg-gradient-to-r from-emerald-950/50 to-neutral-900/70 shadow-lg">
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <div class="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] font-semibold">
              <mat-icon class="text-xs">bolt</mat-icon>
              <span>Paket Hosting Mulai dari</span>
            </div>
            <a
              routerLink="/pricing"
              class="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 flex items-center gap-0.5 cursor-pointer"
            >
              Lihat semua paket <mat-icon class="text-sm">arrow_forward</mat-icon>
            </a>
          </div>

          @if (startingPlan(); as plan) {
            <div class="flex items-baseline gap-1.5">
              <span class="text-xs text-neutral-400">Rp</span>
              <span class="text-xl font-bold font-mono text-white tracking-tight">
                {{ plan.priceIdr.toLocaleString('id-ID') }}
              </span>
              <span class="text-[10px] text-neutral-500 font-mono">/ bln &middot; {{ plan.name }}</span>
            </div>
          }

          <p class="text-[11px] text-neutral-300 mt-2 leading-relaxed">
            Deploy Discord bot, background worker, atau web service langsung ke Render + Cloudflare R2.
            Aktivasi manual via WhatsApp Admin
            <span class="text-emerald-300 font-mono">+62 {{ platformConfig.adminWhatsApp().display }}</span>.
          </p>
        </div>

        <!-- Card Container -->
        <div class="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <!-- Mode Tabs -->
          <div class="flex items-center p-1 bg-neutral-950 rounded-xl mb-6 border border-neutral-800/80">
            <button
              type="button"
              (click)="isRegister.set(false)"
              class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              [class.bg-neutral-800]="!isRegister()"
              [class.text-white]="!isRegister()"
              [class.text-neutral-400]="isRegister()"
            >
              Sign In
            </button>
            <button
              type="button"
              (click)="isRegister.set(true)"
              class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              [class.bg-neutral-800]="isRegister()"
              [class.text-white]="isRegister()"
              [class.text-neutral-400]="!isRegister()"
            >
              Create Account
            </button>
          </div>

          @if (error()) {
            <div class="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2">
              <mat-icon class="text-base shrink-0 mt-0.5">error_outline</mat-icon>
              <div class="flex-1 leading-relaxed">{{ error() }}</div>
            </div>
          }

          @if (!isRegister()) {
            <!-- Login Form -->
            <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">Username or Email</label>
                <div class="relative">
                  <input
                    type="text"
                    formControlName="login"
                    placeholder="admin or user@domain.com"
                    class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">Password</label>
                <div class="relative">
                  <input
                    type="password"
                    formControlName="password"
                    placeholder="••••••••"
                    class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                [disabled]="loading() || loginForm.invalid"
                class="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                @if (loading()) {
                  <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                  <span>Authenticating...</span>
                } @else {
                  <mat-icon class="text-sm">login</mat-icon>
                  <span>Sign In to Panel</span>
                }
              </button>
            </form>
          } @else {
            <!-- Register Form -->
            <form [formGroup]="registerForm" (ngSubmit)="onRegister()" class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">Username</label>
                <input
                  type="text"
                  formControlName="username"
                  placeholder="e.g. devadmin"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-all font-mono"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  formControlName="email"
                  placeholder="user@example.com"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-all font-mono"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">Password</label>
                <input
                  type="password"
                  formControlName="password"
                  placeholder="Min 6 characters"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-all font-mono"
                />
              </div>

              <button
                type="submit"
                [disabled]="loading() || registerForm.invalid"
                class="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                @if (loading()) {
                  <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                  <span>Creating Account...</span>
                } @else {
                  <mat-icon class="text-sm">person_add</mat-icon>
                  <span>Register Account</span>
                }
              </button>
            </form>
          }
        </div>
      </div>
    </div>
  `,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly platformConfig = inject(PlatformConfigService);

  isRegister = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  readonly startingPlan = computed(() => {
    const plans = this.platformConfig.plans();
    if (!plans.length) return null;
    return [...plans].sort((a, b) => a.priceIdr - b.priceIdr)[0];
  });

  constructor() {
    this.platformConfig.load();
  }

  loginForm = new FormGroup({
    login: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required]),
  });

  registerForm = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(3)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  async onLogin() {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    const { login, password } = this.loginForm.value;
    try {
      await this.auth.login(login!, password!);
      this.toast.success('Welcome back to ZetaPanel!');
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err.error?.error || err.message || 'Login failed.');
    } finally {
      this.loading.set(false);
    }
  }

  async onRegister() {
    if (this.registerForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    const { username, email, password } = this.registerForm.value;
    try {
      await this.auth.register(username!, email!, password!);
      this.toast.success('Account created successfully!');
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err.error?.error || err.message || 'Registration failed.');
    } finally {
      this.loading.set(false);
    }
  }
}
