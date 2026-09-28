import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service.js';
import { PlatformConfigService } from '../../core/services/platform-config.service.js';
import { ToastService } from '../../core/services/toast.service.js';

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

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
          {{ title() }}
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
            <!-- Mode Tabs (only on the login / register screens) -->
            @if (mode() === 'login' || mode() === 'register') {
            <div class="flex items-center p-1 bg-neutral-100 rounded mb-5">
              <button
                type="button"
                (click)="setMode('login')"
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
                (click)="setMode('register')"
                class="flex-1 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer"
                [class.bg-white]="isRegister()"
                [class.shadow]="isRegister()"
                [class.text-neutral-800]="isRegister()"
                [class.text-neutral-500]="!isRegister()"
              >
                Create Account
              </button>
            </div>
            }

            @switch (mode()) {
              @case ('login') {
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
                  <button
                    type="button"
                    (click)="setMode('forgot')"
                    class="text-xs text-neutral-400 tracking-wide uppercase hover:text-neutral-600 no-underline cursor-pointer bg-transparent border-0"
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
              }
              @case ('register') {
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
                <p class="text-[11px] text-neutral-400 text-center leading-relaxed">
                  We'll email you a 6-digit code to verify your address.
                </p>
              </form>
              }
              @case ('verify') {
              <form [formGroup]="verifyForm" (ngSubmit)="onVerify()" class="space-y-5">
                <p class="text-sm text-neutral-600 leading-relaxed">
                  We sent a 6-digit code to
                  <span class="font-semibold text-neutral-800 break-all">{{ pendingEmail() }}</span>.
                  Enter it below to finish creating your account. The code expires in 10 minutes.
                </p>
                <div>
                  <label [class]="labelCls">Verification Code</label>
                  <input
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    formControlName="code"
                    placeholder="123456"
                    (input)="onCodeInput(verifyForm.controls.code)"
                    [class]="codeInputCls"
                  />
                </div>
                <button type="submit" [disabled]="loading() || verifyForm.invalid" [class]="btnCls">
                  @if (loading()) {
                    <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                    <span>Verifying...</span>
                  } @else {
                    <span>Verify &amp; Create Account</span>
                  }
                </button>
                <div class="flex items-center justify-between">
                  <button type="button" (click)="setMode('register')" [class]="linkCls">
                    Use a different email
                  </button>
                  <button
                    type="button"
                    (click)="onResendRegister()"
                    [disabled]="cooldown() > 0 || loading()"
                    [class]="linkCls"
                  >
                    {{ cooldown() > 0 ? 'Resend code in ' + cooldown() + 's' : 'Resend code' }}
                  </button>
                </div>
              </form>
              }
              @case ('forgot') {
              <form [formGroup]="forgotForm" (ngSubmit)="onForgot()" class="space-y-5">
                <p class="text-sm text-neutral-600 leading-relaxed">
                  Enter the email address on your account and we'll send you a 6-digit code to reset your password.
                </p>
                <div>
                  <label [class]="labelCls">Email Address</label>
                  <input
                    type="email"
                    formControlName="email"
                    placeholder="user@example.com"
                    [class]="inputCls"
                  />
                </div>
                <button type="submit" [disabled]="loading() || forgotForm.invalid" [class]="btnCls">
                  @if (loading()) {
                    <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                    <span>Sending...</span>
                  } @else {
                    <span>Send Reset Code</span>
                  }
                </button>
                <div class="text-center">
                  <button type="button" (click)="setMode('login')" [class]="linkCls">Back to login</button>
                </div>
              </form>
              }
              @case ('reset') {
              <form [formGroup]="resetForm" (ngSubmit)="onReset()" class="space-y-5">
                <p class="text-sm text-neutral-600 leading-relaxed">
                  If an account exists for
                  <span class="font-semibold text-neutral-800 break-all">{{ pendingEmail() }}</span>,
                  we sent a 6-digit code. Enter it below with your new password. The code expires in 10 minutes.
                </p>
                <div>
                  <label [class]="labelCls">Reset Code</label>
                  <input
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    formControlName="code"
                    placeholder="123456"
                    (input)="onCodeInput(resetForm.controls.code)"
                    [class]="codeInputCls"
                  />
                </div>
                <div>
                  <label [class]="labelCls">New Password</label>
                  <input
                    type="password"
                    formControlName="password"
                    autocomplete="new-password"
                    placeholder="Min 6 characters"
                    [class]="inputCls"
                  />
                </div>
                <div>
                  <label [class]="labelCls">Confirm New Password</label>
                  <input
                    type="password"
                    formControlName="confirm"
                    autocomplete="new-password"
                    placeholder="Repeat new password"
                    [class]="inputCls"
                  />
                </div>
                <button type="submit" [disabled]="loading() || resetForm.invalid" [class]="btnCls">
                  @if (loading()) {
                    <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                    <span>Updating...</span>
                  } @else {
                    <span>Reset Password</span>
                  }
                </button>
                <div class="flex items-center justify-between">
                  <button type="button" (click)="setMode('login')" [class]="linkCls">Back to login</button>
                  <button
                    type="button"
                    (click)="onResendReset()"
                    [disabled]="cooldown() > 0 || loading()"
                    [class]="linkCls"
                  >
                    {{ cooldown() > 0 ? 'Resend code in ' + cooldown() + 's' : 'Resend code' }}
                  </button>
                </div>
              </form>
              }
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

  private destroyRef = inject(DestroyRef);

  mode = signal<Mode>('login');
  isRegister = computed(() => this.mode() === 'register');
  loading = signal(false);
  error = signal<string | null>(null);

  // Email the OTP was sent to (shown on the verify / reset screens).
  pendingEmail = signal('');
  // Seconds until "Resend code" is available again.
  cooldown = signal(0);

  private registrationId = '';
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  readonly title = computed(() => {
    switch (this.mode()) {
      case 'register':
        return 'Create an Account';
      case 'verify':
        return 'Verify Your Email';
      case 'forgot':
        return 'Forgot Password';
      case 'reset':
        return 'Reset Password';
      default:
        return 'Login to Continue';
    }
  });

  readonly startingPlan = computed(() => {
    const plans = this.platformConfig.plans();
    if (!plans.length) return null;
    return [...plans].sort((a, b) => a.priceIdr - b.priceIdr)[0];
  });

  // Shared styles for the OTP / reset screens.
  readonly labelCls = 'block text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1.5';
  readonly inputCls =
    'w-full bg-white border-2 border-neutral-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 rounded px-3.5 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none transition-all';
  readonly codeInputCls =
    'w-full bg-white border-2 border-neutral-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 rounded px-3.5 py-2.5 text-2xl text-center font-mono tracking-[0.5em] text-neutral-800 placeholder-neutral-300 outline-none transition-all';
  readonly btnCls =
    'w-full py-2.5 px-4 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-blue-50 text-sm font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer';
  readonly linkCls =
    'text-xs text-neutral-400 tracking-wide uppercase hover:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-neutral-400 cursor-pointer bg-transparent border-0 p-0';

  constructor() {
    this.platformConfig.load();
    this.destroyRef.onDestroy(() => this.clearCooldown());
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

  verifyForm = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.pattern(/^\d{6}$/)]),
  });

  forgotForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  resetForm = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.pattern(/^\d{6}$/)]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirm: new FormControl('', [Validators.required]),
  });

  setMode(mode: Mode) {
    this.error.set(null);
    this.clearCooldown();
    this.mode.set(mode);
  }

  /** Keeps OTP inputs to digits only (handles paste of "123 456" too). */
  onCodeInput(control: FormControl<string | null>) {
    const digits = (control.value ?? '').replace(/\D/g, '').slice(0, 6);
    if (digits !== control.value) control.setValue(digits);
  }

  private startCooldown(seconds: number) {
    this.clearCooldown();
    this.cooldown.set(seconds);
    this.cooldownTimer = setInterval(() => {
      const next = this.cooldown() - 1;
      if (next <= 0) {
        this.clearCooldown();
      } else {
        this.cooldown.set(next);
      }
    }, 1000);
  }

  private clearCooldown() {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.cooldown.set(0);
  }

  private errorMessage(err: any, fallback: string): string {
    return err?.error?.error || err?.message || fallback;
  }

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
      this.error.set(this.errorMessage(err, 'Login failed.'));
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
      // Step 1: emails a code. The account is created only after step 2 (onVerify).
      const pending = await this.auth.register(username!, email!, password!);
      this.registrationId = pending.registrationId;
      this.pendingEmail.set(pending.email);
      this.verifyForm.reset({ code: '' });
      this.setMode('verify');
      this.startCooldown(pending.resendAfterSeconds);
      this.toast.info(`We sent a 6-digit code to ${pending.email}.`);
    } catch (err: any) {
      this.error.set(this.errorMessage(err, 'Registration failed.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onVerify() {
    if (this.verifyForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.verifyRegistration(this.registrationId, this.verifyForm.value.code!);
      this.toast.success('Email verified. Welcome to ZetaPanel!');
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(this.errorMessage(err, 'Verification failed.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onResendRegister() {
    if (this.cooldown() > 0 || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await this.auth.resendRegistrationCode(this.registrationId);
      this.verifyForm.reset({ code: '' });
      this.startCooldown(res.resendAfterSeconds);
      this.toast.info('A new code has been sent.');
    } catch (err: any) {
      if (err?.status === 429 && err?.error?.retryAfterSeconds) {
        this.startCooldown(err.error.retryAfterSeconds);
      }
      this.error.set(this.errorMessage(err, 'Could not resend the code.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onForgot() {
    if (this.forgotForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    const email = this.forgotForm.value.email!.trim();
    try {
      const res = await this.auth.forgotPassword(email);
      this.pendingEmail.set(email);
      this.resetForm.reset({ code: '', password: '', confirm: '' });
      this.setMode('reset');
      this.startCooldown(res.resendAfterSeconds);
    } catch (err: any) {
      this.error.set(this.errorMessage(err, 'Could not send the reset code.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onResendReset() {
    if (this.cooldown() > 0 || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await this.auth.forgotPassword(this.pendingEmail());
      this.startCooldown(res.resendAfterSeconds);
      this.toast.info('If an account exists, a new code has been sent.');
    } catch (err: any) {
      this.error.set(this.errorMessage(err, 'Could not resend the code.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onReset() {
    if (this.resetForm.invalid) return;

    const { code, password, confirm } = this.resetForm.value;
    if (password !== confirm) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.resetPassword(this.pendingEmail(), code!, password!);
      const email = this.pendingEmail();
      this.loginForm.reset({ login: email, password: '' });
      this.setMode('login');
      this.toast.success('Password updated. Please log in with your new password.');
    } catch (err: any) {
      this.error.set(this.errorMessage(err, 'Could not reset the password.'));
    } finally {
      this.loading.set(false);
    }
  }
}
