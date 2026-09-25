import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service.js';
import { ToastService } from '../../core/services/toast.service.js';

@Component({
  selector: 'app-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-6">
      <div class="border-b border-neutral-800 pb-4">
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <mat-icon class="text-emerald-400">person</mat-icon>
          <span>Account Settings</span>
        </h1>
        <p class="text-xs text-neutral-400 mt-0.5">
          Manage your personal credentials, allocated quotas, and active sessions.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Profile Card -->
        <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4 md:col-span-1 h-fit">
          <div class="flex items-center gap-3 pb-3 border-b border-neutral-800">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-lg flex items-center justify-center uppercase">
              {{ auth.user()?.username?.charAt(0) || 'U' }}
            </div>
            <div class="min-w-0">
              <div class="font-bold text-white text-sm truncate">{{ auth.user()?.username }}</div>
              <div class="text-[11px] text-neutral-500 truncate">{{ auth.user()?.email }}</div>
            </div>
          </div>

          <div class="space-y-3 text-xs font-mono">
            <div>
              <span class="text-neutral-500 block text-[10px] uppercase tracking-wider font-sans">Role</span>
              <span class="text-emerald-400 font-semibold">{{ auth.user()?.role }}</span>
            </div>
            <div>
              <span class="text-neutral-500 block text-[10px] uppercase tracking-wider font-sans">Server Quota</span>
              <span class="text-white">{{ auth.user()?.maxServers }} Max Servers</span>
            </div>
            <div>
              <span class="text-neutral-500 block text-[10px] uppercase tracking-wider font-sans">Storage Quota</span>
              <span class="text-white">{{ auth.user()?.maxStorageMb }} MB R2 Storage</span>
            </div>
            <div>
              <span class="text-neutral-500 block text-[10px] uppercase tracking-wider font-sans">Member Since</span>
              <span class="text-neutral-400">{{ auth.user()?.createdAt?.slice(0, 10) }}</span>
            </div>
          </div>
        </div>

        <!-- Security & Credentials -->
        <div class="space-y-6 md:col-span-2">
          <!-- Update Email & Details -->
          <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
              <mat-icon class="text-sm text-emerald-400">mail</mat-icon>
              <span>Email Address</span>
            </h2>

            <form [formGroup]="emailForm" (ngSubmit)="updateEmail()" class="space-y-3">
              <div>
                <input
                  type="email"
                  formControlName="email"
                  placeholder="your.email@example.com"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>
              <div class="flex justify-end">
                <button
                  type="submit"
                  [disabled]="updatingEmail() || emailForm.invalid"
                  class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Save Email
                </button>
              </div>
            </form>
          </div>

          <!-- Change Password -->
          <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
              <mat-icon class="text-sm text-emerald-400">lock</mat-icon>
              <span>Change Password</span>
            </h2>

            <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1">Current Password</label>
                <input
                  type="password"
                  formControlName="currentPassword"
                  placeholder="••••••••"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1">New Password</label>
                <input
                  type="password"
                  formControlName="newPassword"
                  placeholder="At least 6 characters"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>

              <div class="flex justify-end pt-1">
                <button
                  type="submit"
                  [disabled]="updatingPassword() || passwordForm.invalid"
                  class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Account {
  readonly auth = inject(AuthService);
  private toast = inject(ToastService);

  updatingEmail = signal(false);
  updatingPassword = signal(false);

  emailForm = new FormGroup({
    email: new FormControl(this.auth.user()?.email || '', [Validators.required, Validators.email]),
  });

  passwordForm = new FormGroup({
    currentPassword: new FormControl('', [Validators.required]),
    newPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  async updateEmail() {
    if (this.emailForm.invalid) return;
    this.updatingEmail.set(true);

    try {
      await this.auth.updateAccount({ email: this.emailForm.value.email! });
      this.toast.success('Email updated successfully!');
    } catch (err: any) {
      this.toast.error(err.error?.error || err.message || 'Failed to update email.');
    } finally {
      this.updatingEmail.set(false);
    }
  }

  async changePassword() {
    if (this.passwordForm.invalid) return;
    this.updatingPassword.set(true);

    try {
      await this.auth.updateAccount({
        currentPassword: this.passwordForm.value.currentPassword!,
        newPassword: this.passwordForm.value.newPassword!,
      });
      this.toast.success('Password changed successfully!');
      this.passwordForm.reset();
    } catch (err: any) {
      this.toast.error(err.error?.error || err.message || 'Failed to change password.');
    } finally {
      this.updatingPassword.set(false);
    }
  }
}
