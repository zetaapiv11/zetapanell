import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AdminOverview, User } from '../../core/models/index.js';
import { AdminService } from '../../core/services/admin.service.js';
import { ToastService } from '../../core/services/toast.service.js';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-bold tracking-tight text-white">ZetaPanel Administration</h1>
            <span class="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-[10px] font-mono text-emerald-300 font-semibold uppercase">Super Admin</span>
          </div>
          <p class="text-xs text-neutral-400 mt-0.5">
            Manage users, configure Render API connection, test Cloudflare R2, and system limits.
          </p>
        </div>

        <!-- Admin Tab Buttons -->
        <div class="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto text-xs">
          <button
            type="button"
            (click)="activeTab.set('overview')"
            class="px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
            [class.bg-neutral-800]="activeTab() === 'overview'"
            [class.text-white]="activeTab() === 'overview'"
            [class.text-neutral-400]="activeTab() !== 'overview'"
          >
            Overview
          </button>
          <button
            type="button"
            (click)="activeTab.set('users')"
            class="px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
            [class.bg-neutral-800]="activeTab() === 'users'"
            [class.text-white]="activeTab() === 'users'"
            [class.text-neutral-400]="activeTab() !== 'users'"
          >
            Users
          </button>
          <button
            type="button"
            (click)="activeTab.set('infrastructure')"
            class="px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
            [class.bg-neutral-800]="activeTab() === 'infrastructure'"
            [class.text-white]="activeTab() === 'infrastructure'"
            [class.text-neutral-400]="activeTab() !== 'infrastructure'"
          >
            Render &amp; Storage
          </button>
          <button
            type="button"
            (click)="activeTab.set('settings')"
            class="px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
            [class.bg-neutral-800]="activeTab() === 'settings'"
            [class.text-white]="activeTab() === 'settings'"
            [class.text-neutral-400]="activeTab() !== 'settings'"
          >
            System Limits
          </button>
        </div>
      </div>

      <!-- Tab 1: Overview -->
      @if (activeTab() === 'overview') {
        <div class="space-y-6">
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60">
              <div class="text-xs text-neutral-400 mb-1">Total Users</div>
              <div class="text-2xl font-bold font-mono tabular-nums text-white">
                {{ overview()?.usersCount || 0 }}
              </div>
            </div>

            <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60">
              <div class="text-xs text-neutral-400 mb-1">Total Servers</div>
              <div class="text-2xl font-bold font-mono tabular-nums text-white">
                {{ overview()?.serversCount || 0 }}
              </div>
            </div>

            <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60">
              <div class="text-xs text-neutral-400 mb-1">Render API Connection</div>
              <div class="text-sm font-bold font-mono flex items-center gap-1.5 mt-1" [class.text-emerald-400]="overview()?.infrastructure?.renderConnected" [class.text-rose-400]="!overview()?.infrastructure?.renderConnected">
                <span class="w-2 h-2 rounded-full shrink-0" [class.bg-emerald-400]="overview()?.infrastructure?.renderConnected" [class.bg-rose-400]="!overview()?.infrastructure?.renderConnected"></span>
                <span>{{ overview()?.infrastructure?.renderConnected ? 'Connected' : 'Offline / Unconfigured' }}</span>
              </div>
            </div>

            <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60">
              <div class="text-xs text-neutral-400 mb-1">Cloudflare R2 Bucket</div>
              <div class="text-sm font-bold font-mono text-white truncate mt-1">
                {{ overview()?.infrastructure?.r2Bucket || 'zetapanel-servers' }}
              </div>
            </div>
          </div>

          <!-- Breakdown card -->
          <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
              Infrastructure Status Breakdown
            </h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span class="text-neutral-500">ONLINE:</span>
                <span class="text-emerald-400 font-bold ml-2">{{ overview()?.serversBreakdown?.online || 0 }}</span>
              </div>
              <div>
                <span class="text-neutral-500">BUILDING:</span>
                <span class="text-amber-400 font-bold ml-2">{{ overview()?.serversBreakdown?.deploying || 0 }}</span>
              </div>
              <div>
                <span class="text-neutral-500">FAILED:</span>
                <span class="text-rose-400 font-bold ml-2">{{ overview()?.serversBreakdown?.failed || 0 }}</span>
              </div>
              <div>
                <span class="text-neutral-500">SUSPENDED:</span>
                <span class="text-neutral-400 font-bold ml-2">{{ overview()?.serversBreakdown?.suspended || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Tab 2: Users Management -->
      @if (activeTab() === 'users') {
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-white">Registered Users ({{ users().length }})</h3>
            <button
              type="button"
              (click)="showCreateUserModal.set(true)"
              class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              <mat-icon class="text-sm">person_add</mat-icon>
              <span>Add User</span>
            </button>
          </div>

          <div class="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden font-mono text-xs">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400 text-[11px] uppercase tracking-wider">
                    <th class="py-2.5 px-4 font-sans font-medium">User</th>
                    <th class="py-2.5 px-4">Role</th>
                    <th class="py-2.5 px-4">Status</th>
                    <th class="py-2.5 px-4">Active Plan</th>
                    <th class="py-2.5 px-4">Quota (Srv / R2)</th>
                    <th class="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-800/60 text-neutral-300">
                  @for (u of users(); track u.id) {
                    <tr class="hover:bg-neutral-800/30 transition-colors">
                      <td class="py-3 px-4">
                        <div class="font-sans font-semibold text-white">{{ u.username }}</div>
                        <div class="text-[11px] text-neutral-500">{{ u.email }}</div>
                      </td>
                      <td class="py-3 px-4">
                        <span class="text-[11px] font-semibold" [class.text-emerald-400]="u.role === 'SUPER_ADMIN'" [class.text-amber-400]="u.role === 'ADMIN'" [class.text-neutral-400]="u.role === 'USER'">
                          {{ u.role }}
                        </span>
                      </td>
                      <td class="py-3 px-4">
                        <span class="text-[11px]" [class.text-emerald-400]="u.status === 'ACTIVE'" [class.text-rose-400]="u.status === 'SUSPENDED'">
                          {{ u.status }}
                        </span>
                      </td>
                      <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded text-[11px] font-mono border"
                          [class.bg-emerald-950]="u.plan && u.plan !== 'NONE'"
                          [class.border-emerald-800]="u.plan && u.plan !== 'NONE'"
                          [class.text-emerald-400]="u.plan && u.plan !== 'NONE'"
                          [class.bg-neutral-950]="!u.plan || u.plan === 'NONE'"
                          [class.border-neutral-800]="!u.plan || u.plan === 'NONE'"
                          [class.text-neutral-500]="!u.plan || u.plan === 'NONE'"
                        >
                          {{ u.plan || 'NONE' }}
                        </span>
                      </td>
                      <td class="py-3 px-4 tabular-nums">
                        {{ u.maxServers }} Srv &middot; {{ u.maxStorageMb / 1024 }} GB
                      </td>
                      <td class="py-3 px-4 text-right font-sans">
                        <div class="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            (click)="openUpgradeUserModal(u)"
                            class="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                            title="Upgrade package and quotas for this user"
                          >
                            <mat-icon class="text-xs">upgrade</mat-icon>
                            <span>Upgrade</span>
                          </button>
                          @if (u.status === 'ACTIVE') {
                            <button
                              type="button"
                              (click)="toggleUserSuspend(u, true)"
                              class="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-[11px] cursor-pointer"
                            >
                              Suspend
                            </button>
                          } @else {
                            <button
                              type="button"
                              (click)="toggleUserSuspend(u, false)"
                              class="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-emerald-400 text-[11px] cursor-pointer"
                            >
                              Unsuspend
                            </button>
                          }
                          <button
                            type="button"
                            (click)="deleteUser(u)"
                            class="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-[11px] cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      <!-- Tab 3: Render & Storage Credentials -->
      @if (activeTab() === 'infrastructure') {
        <div class="max-w-3xl space-y-6">
          <!-- Render API Key & Test Connection (Section 36) -->
          <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
                  <mat-icon class="text-sm text-emerald-400">cloud</mat-icon>
                  <span>Render API Configuration</span>
                </h3>
                <p class="text-[11px] text-neutral-500 mt-0.5">
                  Official Render API key for provisioning real services, triggering deploys, and pulling logs.
                </p>
              </div>

              <button
                type="button"
                (click)="testRender()"
                [disabled]="testingRender()"
                class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <mat-icon class="text-sm" [class.animate-spin]="testingRender()">network_check</mat-icon>
                <span>Test Connection</span>
              </button>
            </div>

            <div class="space-y-3 font-mono text-xs">
              <div>
                <label class="block text-[11px] font-sans font-medium text-neutral-300 mb-1">Render API Key</label>
                <input
                  type="password"
                  [formControl]="renderApiKeyControl"
                  placeholder="rnd_xxxxxxxxxxxxxxxxxxxxxxxx"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-white outline-none"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-sans font-medium text-neutral-300 mb-1">Default Workspace / Owner ID</label>
                  <input
                    type="text"
                    [formControl]="renderOwnerIdControl"
                    placeholder="usr_xxxx or tea_xxxx (auto-detected if blank)"
                    class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-sans font-medium text-neutral-300 mb-1">Status</label>
                  <div class="h-9 flex items-center text-neutral-400">
                    {{ renderStatusMsg() || 'Not tested this session' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Cloudflare R2 Credentials & Test Connection (Section 18) -->
          <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
                  <mat-icon class="text-sm text-emerald-400">storage</mat-icon>
                  <span>Cloudflare R2 Object Storage</span>
                </h3>
                <p class="text-[11px] text-neutral-500 mt-0.5">
                  S3-compatible bucket credentials for server file persistence, backups, and ZIP archives.
                </p>
              </div>

              <button
                type="button"
                (click)="testR2()"
                [disabled]="testingR2()"
                class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <mat-icon class="text-sm" [class.animate-spin]="testingR2()">network_check</mat-icon>
                <span>Test R2</span>
              </button>
            </div>

            <div class="space-y-3 font-mono text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-sans font-medium text-neutral-300 mb-1">R2 Account ID</label>
                  <input
                    type="text"
                    [formControl]="r2AccountIdControl"
                    placeholder="e.g. 5f8a9e...32chars"
                    class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-sans font-medium text-neutral-300 mb-1">Bucket Name</label>
                  <input
                    type="text"
                    [formControl]="r2BucketControl"
                    placeholder="zetapanel-servers"
                    class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-sans font-medium text-neutral-300 mb-1">R2 Access Key ID</label>
                  <input
                    type="text"
                    [formControl]="r2AccessKeyIdControl"
                    placeholder="Access Key ID"
                    class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-sans font-medium text-neutral-300 mb-1">R2 Secret Access Key</label>
                  <input
                    type="password"
                    [formControl]="r2SecretAccessKeyControl"
                    placeholder="Secret Access Key"
                    class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Render PostgreSQL Connection Test -->
          <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
                  <mat-icon class="text-sm text-emerald-400">storage</mat-icon>
                  <span>Render PostgreSQL Database</span>
                </h3>
                <p class="text-[11px] text-neutral-500 mt-0.5">
                  Direct connection to Render PostgreSQL instance (Internal or External connection string).
                </p>
              </div>

              <button
                type="button"
                (click)="testPostgres()"
                [disabled]="testingPostgres()"
                class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <mat-icon class="text-sm" [class.animate-spin]="testingPostgres()">sync</mat-icon>
                <span>Test Database</span>
              </button>
            </div>

            <div class="space-y-2 font-mono text-xs">
              <div>
                <label class="block text-[11px] font-sans font-medium text-neutral-300 mb-1">Render PostgreSQL DATABASE_URL</label>
                <input
                  type="password"
                  [formControl]="databaseUrlControl"
                  placeholder="postgresql://user:password@dpg-xxx.render.com/zetapanel"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-white outline-none"
                />
              </div>

              @if (postgresStatusMsg()) {
                <div class="text-[11px] p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-neutral-300">
                  {{ postgresStatusMsg() }}
                </div>
              }
            </div>
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              (click)="saveCredentials()"
              class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <mat-icon class="text-sm">save</mat-icon>
              <span>Save Infrastructure Settings</span>
            </button>
          </div>
        </div>
      }

      <!-- Tab 4: System Settings -->
      @if (activeTab() === 'settings') {
        <div class="max-w-3xl space-y-6">
          <form [formGroup]="systemForm" (ngSubmit)="saveSystemSettings()" class="space-y-5">
            <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
                System Quotas &amp; Registration
              </h3>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-neutral-300 mb-1.5">Panel Name</label>
                  <input
                    type="text"
                    formControlName="panelName"
                    class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-neutral-300 mb-1.5">Max Servers per User</label>
                  <input
                    type="number"
                    formControlName="maxServersPerUser"
                    class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-neutral-300 mb-1.5">Max Storage per User (MB)</label>
                  <input
                    type="number"
                    formControlName="maxStorageMbPerUser"
                    class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                </div>
                <div class="pt-6">
                  <label class="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      formControlName="allowRegistration"
                      class="rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Allow Public Registration</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="flex justify-end">
              <button
                type="submit"
                class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <mat-icon class="text-sm">save</mat-icon>
                <span>Save System Settings</span>
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Create User Modal -->
      @if (showCreateUserModal()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 font-sans">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <mat-icon class="text-emerald-400 text-base">person_add</mat-icon>
                <span>Create User Account</span>
              </h3>
              <button type="button" (click)="showCreateUserModal.set(false)" class="text-neutral-400 hover:text-white cursor-pointer">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <form [formGroup]="createUserForm" (ngSubmit)="submitCreateUser()" class="space-y-3 text-xs">
              <div>
                <label class="block font-medium text-neutral-300 mb-1">Username</label>
                <input
                  type="text"
                  formControlName="username"
                  class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label class="block font-medium text-neutral-300 mb-1">Email</label>
                <input
                  type="email"
                  formControlName="email"
                  class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label class="block font-medium text-neutral-300 mb-1">Password</label>
                <input
                  type="password"
                  formControlName="password"
                  class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono outline-none"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-medium text-neutral-300 mb-1">Role</label>
                  <select
                    formControlName="role"
                    class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono outline-none"
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label class="block font-medium text-neutral-300 mb-1">Max Servers</label>
                  <input
                    type="number"
                    formControlName="maxServers"
                    class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  (click)="showCreateUserModal.set(false)"
                  class="px-3.5 py-1.5 rounded-lg border border-neutral-800 text-neutral-300 hover:bg-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="createUserForm.invalid"
                  class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Upgrade User Package Modal -->
      @if (showUpgradeModal() && targetUpgradeUser()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 font-sans">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                  <mat-icon class="text-emerald-400 text-base">upgrade</mat-icon>
                  <span>Manual Upgrade: &#64;{{ targetUpgradeUser()?.username }}</span>
                </h3>
                <p class="text-[11px] text-neutral-400 mt-0.5">
                  {{ targetUpgradeUser()?.email }} &bull; Current Plan: {{ targetUpgradeUser()?.plan || 'NONE' }}
                </p>
              </div>
              <button type="button" (click)="showUpgradeModal.set(false)" class="text-neutral-400 hover:text-white cursor-pointer">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <form [formGroup]="upgradeForm" (ngSubmit)="submitUserUpgrade()" class="space-y-4 text-xs font-sans">
              <!-- Tier Presets -->
              <div>
                <label class="block font-medium text-neutral-300 mb-1.5">Select Hosting Tier Preset</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="applyPlanPreset('Bot Starter', 1, 2048)"
                    class="p-2 rounded-lg border text-left cursor-pointer transition-colors"
                    [class.border-emerald-500]="upgradeForm.get('plan')?.value === 'Bot Starter'"
                    [class.bg-emerald-950/40]="upgradeForm.get('plan')?.value === 'Bot Starter'"
                    [class.border-neutral-800]="upgradeForm.get('plan')?.value !== 'Bot Starter'"
                    [class.bg-neutral-950]="upgradeForm.get('plan')?.value !== 'Bot Starter'"
                  >
                    <div class="font-semibold text-white">Bot Starter</div>
                    <div class="text-[10px] text-neutral-400 font-mono">1 Server &middot; 2GB R2</div>
                  </button>

                  <button
                    type="button"
                    (click)="applyPlanPreset('Developer Worker', 3, 10240)"
                    class="p-2 rounded-lg border text-left cursor-pointer transition-colors"
                    [class.border-emerald-500]="upgradeForm.get('plan')?.value === 'Developer Worker'"
                    [class.bg-emerald-950/40]="upgradeForm.get('plan')?.value === 'Developer Worker'"
                    [class.border-neutral-800]="upgradeForm.get('plan')?.value !== 'Developer Worker'"
                    [class.bg-neutral-950]="upgradeForm.get('plan')?.value !== 'Developer Worker'"
                  >
                    <div class="font-semibold text-white">Developer Worker</div>
                    <div class="text-[10px] text-neutral-400 font-mono">3 Servers &middot; 10GB R2</div>
                  </button>

                  <button
                    type="button"
                    (click)="applyPlanPreset('Pro Power Cluster', 8, 40960)"
                    class="p-2 rounded-lg border text-left cursor-pointer transition-colors"
                    [class.border-emerald-500]="upgradeForm.get('plan')?.value === 'Pro Power Cluster'"
                    [class.bg-emerald-950/40]="upgradeForm.get('plan')?.value === 'Pro Power Cluster'"
                    [class.border-neutral-800]="upgradeForm.get('plan')?.value !== 'Pro Power Cluster'"
                    [class.bg-neutral-950]="upgradeForm.get('plan')?.value !== 'Pro Power Cluster'"
                  >
                    <div class="font-semibold text-white">Pro Cluster</div>
                    <div class="text-[10px] text-neutral-400 font-mono">8 Servers &middot; 40GB R2</div>
                  </button>

                  <button
                    type="button"
                    (click)="applyPlanPreset('Enterprise Dedicated', 25, 153600)"
                    class="p-2 rounded-lg border text-left cursor-pointer transition-colors"
                    [class.border-emerald-500]="upgradeForm.get('plan')?.value === 'Enterprise Dedicated'"
                    [class.bg-emerald-950/40]="upgradeForm.get('plan')?.value === 'Enterprise Dedicated'"
                    [class.border-neutral-800]="upgradeForm.get('plan')?.value !== 'Enterprise Dedicated'"
                    [class.bg-neutral-950]="upgradeForm.get('plan')?.value !== 'Enterprise Dedicated'"
                  >
                    <div class="font-semibold text-white">Enterprise</div>
                    <div class="text-[10px] text-neutral-400 font-mono">25 Servers &middot; 150GB R2</div>
                  </button>
                </div>
              </div>

              <div>
                <label class="block font-medium text-neutral-300 mb-1">Plan Name</label>
                <input
                  type="text"
                  formControlName="plan"
                  placeholder="e.g. Developer Worker"
                  class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono outline-none"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-medium text-neutral-300 mb-1">Max Servers Quota</label>
                  <input
                    type="number"
                    formControlName="maxServers"
                    class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label class="block font-medium text-neutral-300 mb-1">Max Storage (MB)</label>
                  <input
                    type="number"
                    formControlName="maxStorageMb"
                    class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  (click)="showUpgradeModal.set(false)"
                  class="px-3.5 py-1.5 rounded-lg border border-neutral-800 text-neutral-300 hover:bg-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="upgradeForm.invalid || upgradingUser()"
                  class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  @if (upgradingUser()) {
                    <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                    <span>Upgrading...</span>
                  } @else {
                    <mat-icon class="text-sm">verified</mat-icon>
                    <span>Save &amp; Activate Plan</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class Admin implements OnInit {
  private adminService = inject(AdminService);
  private toast = inject(ToastService);

  activeTab = signal<'overview' | 'users' | 'infrastructure' | 'settings'>('overview');
  overview = signal<AdminOverview | null>(null);
  users = signal<User[]>([]);

  testingRender = signal<boolean>(false);
  renderStatusMsg = signal<string>('');
  testingR2 = signal<boolean>(false);

  // Infrastructure controls
  renderApiKeyControl = new FormControl('');
  renderOwnerIdControl = new FormControl('');
  r2AccountIdControl = new FormControl('');
  r2BucketControl = new FormControl('');
  r2AccessKeyIdControl = new FormControl('');
  r2SecretAccessKeyControl = new FormControl('');
  databaseUrlControl = new FormControl('');

  testingPostgres = signal<boolean>(false);
  postgresStatusMsg = signal<string>('');

  // System settings form
  systemForm = new FormGroup({
    panelName: new FormControl('ZetaPanel'),
    maxServersPerUser: new FormControl(5),
    maxStorageMbPerUser: new FormControl(1024),
    allowRegistration: new FormControl(true),
  });

  // User modal
  showCreateUserModal = signal<boolean>(false);
  createUserForm = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(3)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    role: new FormControl('USER'),
    maxServers: new FormControl(5),
  });

  // Upgrade user package modal
  showUpgradeModal = signal<boolean>(false);
  targetUpgradeUser = signal<User | null>(null);
  upgradingUser = signal<boolean>(false);
  upgradeForm = new FormGroup({
    plan: new FormControl('Developer Worker', [Validators.required]),
    maxServers: new FormControl(3, [Validators.required]),
    maxStorageMb: new FormControl(10240, [Validators.required]),
  });

  openUpgradeUserModal(user: User) {
    this.targetUpgradeUser.set(user);
    this.upgradeForm.patchValue({
      plan: user.plan && user.plan !== 'NONE' ? user.plan : 'Developer Worker',
      maxServers: user.maxServers || 3,
      maxStorageMb: user.maxStorageMb || 10240,
    });
    this.showUpgradeModal.set(true);
  }

  applyPlanPreset(name: string, maxServers: number, maxStorageMb: number) {
    this.upgradeForm.patchValue({
      plan: name,
      maxServers,
      maxStorageMb,
    });
  }

  async submitUserUpgrade() {
    const user = this.targetUpgradeUser();
    if (!user || this.upgradeForm.invalid) return;

    this.upgradingUser.set(true);
    try {
      const val = this.upgradeForm.value;
      const updated = await this.adminService.updateUser(user.id, {
        plan: val.plan!,
        maxServers: Number(val.maxServers),
        maxStorageMb: Number(val.maxStorageMb),
      });

      this.toast.success(`User @${user.username} upgraded to '${updated.plan}'!`);
      this.showUpgradeModal.set(false);
      this.loadUsers();
    } catch (err: any) {
      this.toast.error(err.message || 'Upgrade failed.');
    } finally {
      this.upgradingUser.set(false);
    }
  }

  ngOnInit() {
    this.loadOverview();
    this.loadUsers();
    this.loadSettings();
  }

  async loadOverview() {
    try {
      const data = await this.adminService.getOverview();
      this.overview.set(data);
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to load admin overview.');
    }
  }

  async loadUsers() {
    try {
      const data = await this.adminService.getUsers();
      this.users.set(data);
    } catch {}
  }

  async loadSettings() {
    try {
      const s = await this.adminService.getSettings();
      this.renderApiKeyControl.setValue(s.renderApiKeyMasked || s.renderApiKey || '');
      this.renderOwnerIdControl.setValue(s.renderOwnerId || '');
      this.r2AccountIdControl.setValue(s.r2AccountId || '');
      this.r2BucketControl.setValue(s.r2Bucket || '');
      this.r2AccessKeyIdControl.setValue(s.r2AccessKeyId || '');
      this.r2SecretAccessKeyControl.setValue(s.r2SecretAccessKeyMasked || s.r2SecretAccessKey || '');

      this.systemForm.patchValue({
        panelName: s.panelName || 'ZetaPanel',
        maxServersPerUser: s.maxServersPerUser || 5,
        maxStorageMbPerUser: s.maxStorageMbPerUser || 1024,
        allowRegistration: s.allowRegistration !== false,
      });
    } catch {}
  }

  async testRender() {
    this.testingRender.set(true);
    this.renderStatusMsg.set('Connecting to Render API...');
    try {
      const apiKey = this.renderApiKeyControl.value || undefined;
      const res = await this.adminService.testRenderConnection(apiKey);
      this.renderStatusMsg.set(`Connected! (${res.owners.length} workspaces)`);
      this.toast.success(res.message);
    } catch (err: any) {
      this.renderStatusMsg.set(`Failed: ${err.message}`);
      this.toast.error(err.message || 'Render connection failed.');
    } finally {
      this.testingRender.set(false);
    }
  }

  async testR2() {
    this.testingR2.set(true);
    try {
      const res = await this.adminService.testR2Connection();
      this.toast.success(res.message);
    } catch (err: any) {
      this.toast.error(err.message || 'Cloudflare R2 test failed.');
    } finally {
      this.testingR2.set(false);
    }
  }

  async testPostgres() {
    this.testingPostgres.set(true);
    this.postgresStatusMsg.set('Connecting to Render PostgreSQL...');
    try {
      const token = localStorage.getItem('zp_token');
      const res = await fetch('/api/v1/admin/test-postgres', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ databaseUrl: this.databaseUrlControl.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Connection failed');
      this.postgresStatusMsg.set(`Connected! ${data.version || ''}`);
      this.toast.success(data.message);
    } catch (err: any) {
      this.postgresStatusMsg.set(`Failed: ${err.message}`);
      this.toast.error(err.message || 'PostgreSQL connection failed');
    } finally {
      this.testingPostgres.set(false);
    }
  }

  async saveCredentials() {
    try {
      const payload: any = {
        renderApiKey: this.renderApiKeyControl.value,
        renderOwnerId: this.renderOwnerIdControl.value,
        r2AccountId: this.r2AccountIdControl.value,
        r2Bucket: this.r2BucketControl.value,
        r2AccessKeyId: this.r2AccessKeyIdControl.value,
        r2SecretAccessKey: this.r2SecretAccessKeyControl.value,
      };

      await this.adminService.updateSettings(payload);
      this.toast.success('Infrastructure settings saved!');
      this.loadOverview();
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to save settings.');
    }
  }

  async saveSystemSettings() {
    try {
      await this.adminService.updateSettings(this.systemForm.value);
      this.toast.success('System settings updated!');
      this.loadOverview();
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to update system settings.');
    }
  }

  async toggleUserSuspend(user: User, suspend: boolean) {
    try {
      await this.adminService.updateUser(user.id, {
        status: suspend ? 'SUSPENDED' : 'ACTIVE',
      });
      this.toast.success(`User ${user.username} ${suspend ? 'suspended' : 'unsuspended'}.`);
      this.loadUsers();
    } catch (err: any) {
      this.toast.error(err.message || 'Action failed.');
    }
  }

  async deleteUser(user: User) {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) return;
    try {
      await this.adminService.deleteUser(user.id);
      this.toast.success(`User ${user.username} deleted.`);
      this.loadUsers();
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to delete user.');
    }
  }

  async submitCreateUser() {
    if (this.createUserForm.invalid) return;
    try {
      await this.adminService.createUser(this.createUserForm.value as any);
      this.toast.success('User created!');
      this.showCreateUserModal.set(false);
      this.createUserForm.reset({ role: 'USER', maxServers: 5 });
      this.loadUsers();
    } catch (err: any) {
      this.toast.error(err.error?.error || err.message || 'Failed to create user.');
    }
  }
}
