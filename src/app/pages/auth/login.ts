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
    <div class="min-h-screen bg-neutral-800 flex flex-col justify-center items-center px-4 py-12 font-sans selection:bg-blue-500 selection:text-white">
      <div class="w-full max-w-2xl">
        <!-- Pricing Teaser -->
        <div class="mb-4 p-3.5 rounded border border-blue-800/60 bg-blue-950/40 shadow-lg">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-1.5 text-blue-300 font-mono text-[11px] font-semibold">
              <mat-icon class="text-xs">bolt</mat-icon>
              <span>Paket Hosting Mulai dari</span>
            </div>
            <a routerLink="/pricing" class="text-[11px] font-semibold text-blue-300 hover:text-blue-200 flex items-center gap-0.5 cursor-pointer">
              Lihat semua paket <mat-icon class="text-sm">arrow_forward</mat-icon>
            </a>
          </div>
          @if (startingPlan(); as plan) {
            <div class="flex items-baseline gap-1.5">
              <span class="text-xs text-neutral-300">Rp</span>
              <span class="text-xl font-semibold font-mono text-neutral-50 tracking-tight">
                {{ plan.priceIdr.toLocaleString('id-ID') }}
              </span>
              <span class="text-[10px] text-neutral-400 font-mono">/ bln &middot; {{ plan.name }}</span>
            </div>
          }
          <p class="text-[11px] text-neutral-300 mt-1.5 leading-relaxed">
            Deploy Discord bot, background worker, atau web service langsung ke Render + Cloudflare R2.
            Aktivasi manual via WhatsApp Admin
            <span class="text-blue-300 font-mono">+62 {{ platformConfig.adminWhatsApp().display }}</span>.
          </p>
        </div>

        <!-- Title (matches LoginFormContainer's title) -->
        <h2 class="text-3xl text-center text-neutral-50 font-medium py-4">
          {{ isRegister() ? 'Create an Account' : 'Login to Continue' }}
        </h2>

        @if (error()) {
          <div class="mb-2 mx-1 p-3 rounded bg-red-950/60 border border-red-800/50 text-red-300 text-xs flex items-start gap-2">
            <mat-icon class="text-base shrink-0 mt-0.5">error_outline</mat-icon>
            <div class="flex-1 leading-relaxed">{{ error() }}</div>
          </div>
        }

        <!-- White Card: logo panel (left) + form (right) -- matches
             Pterodactyl's LoginFormContainer.tsx exactly (bg-white, rounded,
             shadow-lg, split layout) instead of a dark card. -->
        <div class="md:flex w-full bg-white shadow-lg rounded p-6 md:pl-0 mx-1">
          <div class="flex-none select-none mb-6 md:mb-0 self-center md:w-64 flex flex-col items-center justify-center gap-2">
            <div class="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-3xl shadow-inner">
              Z
            </div>
            <span class="text-neutral-700 font-semibold text-sm">ZetaPanel</span>
          </div>

          <div class="flex-1">
            <!-- Mode Tabs -->
            <div class="flex items-center p-1 bg-neutral-100 rounded mb-5">
              <button
                type="button"
                (click)="isRegister.set(false)"
                class="flex-1 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer"
                [class.bg-white]="!isRegister()"
                [class.shadow]="!isRegister()"
                [class.text-neutral-800]="!isRegister()"
                [class.text-neutral-500]="isRegister()"
              >
                Sign In
              </button>
              <button
                type="button"
                (click)="isRegister.set(true)"
                class="flex-1 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer"
                [class.bg-white]="isRegister()"
                [class.shadow]="isRegister()"
                [class.text-neutral-800]="isRegister()"
                [class.text-neutral-500]="!isRegister()"
              >
                Create Account
              </button>
            </div>

            @if (!isRegister()) {
              <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="space-y-5">
                <div>
                  <label class="block text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1.5">Username or Email</label>
                  <input
                    type="text"
                    formControlName="login"
                    placeholder="admin or user@domain.com"
                    class="w-full bg-white border-2 border-neutral-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 rounded px-3.5 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none transition-all"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1.5">Password</label>
                  <input
                    type="password"
                    formControlName="password"
                    placeholder="••••••••"
                    class="w-full bg-white border-2 border-neutral-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 rounded px-3.5 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  [disabled]="loading() || loginForm.invalid"
                  class="w-full py-2.5 px-4 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-blue-50 text-sm font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  @if (loading()) {
                    <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                    <span>Authenticating...</span>
                  } @else {
                    <span>Login</span>
                  }
                </button>

                <div class="text-center">
                  <a class="text-xs text-neutral-400 tracking-wide uppercase hover:text-neutral-600 no-underline cursor-pointer">
                    Forgot password?
                  </a>
                </div>
              </form>
            } @else {
              <form [formGroup]="registerForm" (ngSubmit)="onRegister()" class="space-y-5">
                <div>
                  <label class="block text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1.5">Username</label>
                  <input
                    type="text"
                    formControlName="username"
                    placeholder="e.g. devadmin"
                    class="w-full bg-white border-2 border-neutral-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 rounded px-3.5 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none transition-all"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1.5">Email Address</label>
                  <input
                    type="email"
                    formControlName="email"
                    placeholder="user@example.com"
                    class="w-full bg-white border-2 border-neutral-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 rounded px-3.5 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none transition-all"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1.5">Password</label>
                  <input
                    type="password"
                    formControlName="password"
                    placeholder="Min 6 characters"
                    class="w-full bg-white border-2 border-neutral-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 rounded px-3.5 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  [disabled]="loading() || registerForm.invalid"
                  class="w-full py-2.5 px-4 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-blue-50 text-sm font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  @if (loading()) {
                    <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                    <span>Creating Account...</span>
                  } @else {
                    <span>Register</span>
                  }
                </button>
              </form>
            }
          </div>
        </div>

        <!-- Footer (matches LoginFormContainer's copyright line) -->
        <p class="text-center text-neutral-500 text-xs mt-4">
          &copy; 2026 ZetaPanel &mdash; Infrastructure Control Panel powered by Render &amp; Cloudflare R2
        </p>
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
