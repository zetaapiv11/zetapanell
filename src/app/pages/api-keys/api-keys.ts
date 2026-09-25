import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ApiKeyItem } from '../../core/models/index.js';
import { ApiKeyService } from '../../core/services/api-key.service.js';
import { ToastService } from '../../core/services/toast.service.js';

@Component({
  selector: 'app-api-keys',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-white">API Keys</h1>
          <p class="text-xs text-neutral-400 mt-0.5">
            Manage granular authentication credentials for the ZetaPanel REST API.
          </p>
        </div>

        <button
          type="button"
          (click)="openCreateModal()"
          class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm self-start sm:self-auto"
        >
          <mat-icon class="text-sm">add</mat-icon>
          <span>Create API Key</span>
        </button>
      </div>

      <!-- Keys Table -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden font-mono text-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400 text-[11px] uppercase tracking-wider">
                <th class="py-2.5 px-4 font-sans font-medium">Name</th>
                <th class="py-2.5 px-4">Key Identifier</th>
                <th class="py-2.5 px-4">Permissions</th>
                <th class="py-2.5 px-4">Last Used</th>
                <th class="py-2.5 px-4">Created</th>
                <th class="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-800/60 text-neutral-300">
              @if (loading() && keys().length === 0) {
                <tr>
                  <td colspan="6" class="p-8 text-center text-neutral-500 font-sans">
                    <mat-icon class="text-xl animate-spin mb-1">refresh</mat-icon>
                    <div>Loading keys...</div>
                  </td>
                </tr>
              } @else if (keys().length === 0) {
                <tr>
                  <td colspan="6" class="p-8 text-center text-neutral-500 font-sans italic">
                    No active API keys found. Generate one to access ZetaPanel via REST API.
                  </td>
                </tr>
              } @else {
                @for (k of keys(); track k.id) {
                  <tr class="hover:bg-neutral-800/30 transition-colors">
                    <td class="py-3 px-4 font-sans font-semibold text-white">
                      {{ k.name }}
                    </td>
                    <td class="py-3 px-4 text-neutral-300">
                      {{ k.keyPrefix }}
                    </td>
                    <td class="py-3 px-4">
                      <div class="flex flex-wrap gap-1">
                        @for (p of k.permissions; track p) {
                          <span class="text-[10px] text-neutral-400 font-mono">{{ p }}</span>
                        }
                      </div>
                    </td>
                    <td class="py-3 px-4 text-neutral-500 text-[11px] tabular-nums">
                      {{ k.lastUsedAt ? k.lastUsedAt.slice(0, 10) : 'Never' }}
                    </td>
                    <td class="py-3 px-4 text-neutral-500 text-[11px] tabular-nums">
                      {{ k.createdAt.slice(0, 10) }}
                    </td>
                    <td class="py-3 px-4 text-right">
                      <button
                        type="button"
                        (click)="revokeKey(k)"
                        class="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-[11px] font-sans font-medium transition-colors cursor-pointer"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create API Key Modal -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 font-sans">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <mat-icon class="text-emerald-400 text-base">vpn_key</mat-icon>
                <span>Create New API Key</span>
              </h3>
              <button type="button" (click)="showCreateModal.set(false)" class="text-neutral-400 hover:text-white cursor-pointer">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Description / Name</label>
              <input
                type="text"
                [formControl]="nameControl"
                placeholder="e.g. CI/CD Bot or Automation Script"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-2">Granular Permissions</label>
              <div class="grid grid-cols-2 gap-2 text-xs font-mono">
                @for (perm of availablePermissions; track perm) {
                  <label class="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      [checked]="selectedPermissions().includes(perm)"
                      (change)="togglePermission(perm)"
                      class="rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span class="text-neutral-300 text-[11px]">{{ perm }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="showCreateModal.set(false)"
                class="px-3.5 py-1.5 rounded-lg border border-neutral-800 text-xs font-medium text-neutral-300 hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="createKey()"
                [disabled]="creatingKey() || !nameControl.value"
                class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Key Revealed Modal (Shown ONCE) -->
      @if (newlyCreatedKey()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 font-sans">
            <div class="flex items-center gap-2 text-emerald-400">
              <mat-icon class="text-xl">check_circle</mat-icon>
              <h3 class="text-sm font-bold text-white">API Key Generated</h3>
            </div>

            <p class="text-xs text-neutral-300 leading-relaxed">
              Please copy your API key now. For your security, <strong class="text-white">it will never be shown again</strong>.
            </p>

            <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 font-mono text-xs text-emerald-400 break-all select-all flex items-center justify-between gap-2">
              <span>{{ newlyCreatedKey() }}</span>
              <button
                type="button"
                (click)="copySecretKey()"
                class="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-sans text-xs shrink-0 cursor-pointer"
              >
                Copy
              </button>
            </div>

            <div class="flex justify-end pt-2">
              <button
                type="button"
                (click)="newlyCreatedKey.set(null)"
                class="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold cursor-pointer"
              >
                I have saved this key
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ApiKeys implements OnInit {
  private apiKeyService = inject(ApiKeyService);
  private toast = inject(ToastService);

  keys = signal<ApiKeyItem[]>([]);
  loading = signal<boolean>(false);
  creatingKey = signal<boolean>(false);

  showCreateModal = signal<boolean>(false);
  nameControl = new FormControl('', [Validators.required]);
  selectedPermissions = signal<string[]>([
    'servers.read',
    'servers.create',
    'render.deploy',
    'render.restart',
    'render.logs',
  ]);

  newlyCreatedKey = signal<string | null>(null);

  readonly availablePermissions = [
    'servers.read',
    'servers.create',
    'servers.update',
    'servers.delete',
    'render.deploy',
    'render.restart',
    'render.logs',
    'render.env',
    'files.read',
    'files.write',
  ];

  ngOnInit() {
    this.loadKeys();
  }

  async loadKeys() {
    this.loading.set(true);
    try {
      const data = await this.apiKeyService.getApiKeys();
      this.keys.set(data);
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to load API keys.');
    } finally {
      this.loading.set(false);
    }
  }

  openCreateModal() {
    this.nameControl.setValue('');
    this.showCreateModal.set(true);
  }

  togglePermission(perm: string) {
    this.selectedPermissions.update((current) => {
      if (current.includes(perm)) {
        return current.filter((p) => p !== perm);
      } else {
        return [...current, perm];
      }
    });
  }

  async createKey() {
    if (!this.nameControl.value) return;
    this.creatingKey.set(true);

    try {
      const result = await this.apiKeyService.createApiKey(
        this.nameControl.value.trim(),
        this.selectedPermissions()
      );
      this.showCreateModal.set(false);
      this.newlyCreatedKey.set(result.secretToken);
      this.loadKeys();
      this.toast.success('API key generated successfully!');
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to create API key.');
    } finally {
      this.creatingKey.set(false);
    }
  }

  copySecretKey() {
    const key = this.newlyCreatedKey();
    if (key) {
      navigator.clipboard.writeText(key);
      this.toast.info('API Key copied to clipboard.');
    }
  }

  async revokeKey(key: ApiKeyItem) {
    if (!confirm(`Are you sure you want to revoke key "${key.name}"?`)) return;

    try {
      await this.apiKeyService.deleteApiKey(key.id);
      this.toast.success(`Revoked API key ${key.name}`);
      this.loadKeys();
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to revoke API key.');
    }
  }
}
