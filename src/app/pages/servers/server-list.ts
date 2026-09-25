import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ServerItem } from '../../core/models/index.js';
import { AuthService } from '../../core/services/auth.service.js';
import { PlatformConfigService } from '../../core/services/platform-config.service.js';
import { ServerService } from '../../core/services/server.service.js';
import { ToastService } from '../../core/services/toast.service.js';
import { StatusBadge } from '../../shared/components/status-badge.js';

@Component({
  selector: 'app-server-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, MatIconModule, StatusBadge],
  template: `
    <div class="space-y-5 font-sans">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-white">Your Servers</h1>
          <p class="text-xs text-neutral-400 mt-0.5">
            Manage your instances deployed on Render with Cloudflare R2 storage.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="loadServers()"
            [disabled]="loading()"
            class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <mat-icon class="text-sm" [class.animate-spin]="loading()">refresh</mat-icon>
            <span>Sync</span>
          </button>
          @if (hasNoQuota()) {
            <a
              [href]="buyQuotaWaUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <mat-icon class="text-sm">chat</mat-icon>
              <span>Beli Paket di WA</span>
            </a>
          } @else {
            <a
              routerLink="/servers/new"
              class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <mat-icon class="text-sm">add</mat-icon>
              <span>Create Server</span>
            </a>
          }
        </div>
      </div>

      <!-- Filter Controls & Search -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-neutral-900/60 border border-neutral-800 rounded-xl">
        <div class="relative flex-1 max-w-sm">
          <mat-icon class="absolute left-3 top-2.5 text-sm text-neutral-500">search</mat-icon>
          <input
            type="text"
            [formControl]="searchControl"
            placeholder="Search servers by name, ID, or runtime..."
            class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none transition-all font-mono"
          />
        </div>

        <div class="flex items-center gap-1.5 text-xs text-neutral-400 overflow-x-auto pb-1 sm:pb-0">
          <span class="text-neutral-500 text-[11px] mr-1 hidden sm:inline">Runtime:</span>
          @for (rt of ['all', 'node', 'python', 'docker', 'go']; track rt) {
            <button
              type="button"
              (click)="selectedRuntime.set(rt)"
              class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer capitalize"
              [class.bg-neutral-800]="selectedRuntime() === rt"
              [class.text-white]="selectedRuntime() === rt"
              [class.text-neutral-400]="selectedRuntime() !== rt"
            >
              {{ rt }}
            </button>
          }
        </div>
      </div>

      <!-- Server Table (High-Density Pterodactyl-Style) -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-neutral-800/80 bg-neutral-950/60 text-neutral-400 text-[11px] font-medium font-mono uppercase tracking-wider">
                <th class="py-3 px-4">Server</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4">Runtime / Type</th>
                <th class="py-3 px-4">Region</th>
                <th class="py-3 px-4">Plan</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-800/60 text-neutral-300">
              @if (loading() && servers().length === 0) {
                <tr>
                  <td colspan="6" class="p-8 text-center text-neutral-500">
                    <mat-icon class="text-xl animate-spin mb-1">refresh</mat-icon>
                    <div>Connecting to Render API...</div>
                  </td>
                </tr>
              } @else if (filteredServers().length === 0) {
                <tr>
                  <td colspan="6" class="p-8 text-center text-neutral-400">
                    @if (hasNoQuota()) {
                      <div class="max-w-md mx-auto space-y-3 py-2">
                        <div class="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                          <mat-icon class="text-2xl">lock</mat-icon>
                        </div>
                        <div>
                          <div class="text-sm font-bold text-white">Akun Belum Memiliki Kuota Server</div>
                          <div class="text-xs text-neutral-400 mt-1 leading-relaxed">
                            Anda belum membeli paket server atau kuota Anda masih 0 server. Silakan hubungi Admin di WhatsApp untuk membeli dan mengaktifkan paket hosting.
                          </div>
                        </div>
                        <div class="flex items-center justify-center gap-2 pt-2">
                          <a
                            [href]="buyQuotaWaUrl()"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <mat-icon class="text-sm">chat</mat-icon>
                            <span>Chat WA Admin (+62 {{ platformConfig.adminWhatsApp().display }})</span>
                          </a>
                          <a
                            routerLink="/plans"
                            class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium cursor-pointer"
                          >
                            Lihat Paket
                          </a>
                        </div>
                      </div>
                    } @else {
                      <div class="text-neutral-500">No matching servers found.</div>
                    }
                  </td>
                </tr>
              } @else {
                @for (server of filteredServers(); track server.id) {
                  <tr class="hover:bg-neutral-800/30 transition-colors group">
                    <td class="py-3.5 px-4">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-neutral-400 group-hover:text-emerald-400 font-mono text-xs">
                          {{ server.name.charAt(0).toUpperCase() }}
                        </div>
                        <div>
                          <a
                            [routerLink]="['/servers', server.id, 'console']"
                            class="font-semibold text-white hover:text-emerald-400 transition-colors block text-xs"
                          >
                            {{ server.name }}
                          </a>
                          <div class="text-[10px] text-neutral-500 font-mono">
                            {{ server.renderServiceId }}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3.5 px-4 whitespace-nowrap">
                      <app-status-badge [status]="server.status"></app-status-badge>
                    </td>
                    <td class="py-3.5 px-4 whitespace-nowrap">
                      <div class="font-mono text-neutral-200 capitalize">{{ server.runtime }}</div>
                      <div class="text-[10px] text-neutral-500 font-mono">{{ server.serviceType }}</div>
                    </td>
                    <td class="py-3.5 px-4 whitespace-nowrap font-mono text-neutral-400">
                      {{ server.region }}
                    </td>
                    <td class="py-3.5 px-4 whitespace-nowrap font-mono text-neutral-400 capitalize">
                      {{ server.plan }}
                    </td>
                    <td class="py-3.5 px-4 text-right whitespace-nowrap">
                      <div class="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          (click)="deploy(server)"
                          title="Deploy on Render"
                          class="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                        >
                          <mat-icon class="text-sm">rocket_launch</mat-icon>
                        </button>
                        <button
                          type="button"
                          (click)="restart(server)"
                          title="Restart Render Service"
                          class="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          <mat-icon class="text-sm">restart_alt</mat-icon>
                        </button>
                        <a
                          [routerLink]="['/servers', server.id, 'console']"
                          class="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-medium transition-colors"
                        >
                          Console
                        </a>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class ServerList implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly platformConfig = inject(PlatformConfigService);
  private serverService = inject(ServerService);
  private toast = inject(ToastService);

  buyQuotaWaUrl(): string {
    const wa = this.platformConfig.adminWhatsApp();
    const text = 'Halo Admin ZetaPanel, saya ingin membeli dan mengaktifkan kuota server hosting.';
    return `https://wa.me/${wa.number}?text=${encodeURIComponent(text)}`;
  }

  hasNoQuota = computed(() => {
    const u = this.auth.user();
    if (!u) return false;
    if (u.role === 'SUPER_ADMIN') return false;
    return (u.maxServers || 0) <= 0;
  });

  servers = signal<ServerItem[]>([]);
  loading = signal<boolean>(false);
  selectedRuntime = signal<string>('all');
  searchControl = new FormControl('');

  private pollInterval?: any;

  readonly filteredServers = computed(() => {
    const list = this.servers();
    const q = (this.searchControl.value || '').toLowerCase();
    const rt = this.selectedRuntime();

    return list.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.renderServiceId.toLowerCase().includes(q) ||
        s.runtime.toLowerCase().includes(q);
      const matchesRt = rt === 'all' || s.runtime === rt;
      return matchesSearch && matchesRt;
    });
  });

  ngOnInit() {
    this.platformConfig.load();
    this.loadServers();
    // Auto-poll status from Render API every 15 seconds
    this.pollInterval = setInterval(() => {
      this.loadServers(true);
    }, 15000);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  async loadServers(silent = false) {
    if (!silent) this.loading.set(true);
    try {
      const data = await this.serverService.getServers();
      this.servers.set(data);
    } catch (err: any) {
      if (!silent) this.toast.error(err.message || 'Failed to fetch servers.');
    } finally {
      if (!silent) this.loading.set(false);
    }
  }

  async deploy(server: ServerItem) {
    try {
      this.toast.info(`Deploying ${server.name} on Render...`);
      await this.serverService.deploy(server.id, false);
      this.toast.success(`Deploy initiated!`);
      this.loadServers(true);
    } catch (err: any) {
      this.toast.error(err.message || 'Deploy failed.');
    }
  }

  async restart(server: ServerItem) {
    try {
      this.toast.info(`Restarting ${server.name}...`);
      await this.serverService.restart(server.id);
      this.toast.success(`Restart request sent to Render.`);
      this.loadServers(true);
    } catch (err: any) {
      this.toast.error(err.message || 'Restart failed.');
    }
  }
}
