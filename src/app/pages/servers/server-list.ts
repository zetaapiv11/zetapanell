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
            class="px-3 py-1.5 rounded border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <mat-icon class="text-sm" [class.animate-spin]="loading()">refresh</mat-icon>
            <span>Sync</span>
          </button>
          @if (hasNoQuota()) {
            <a
              [href]="buyQuotaWaUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <mat-icon class="text-sm">chat</mat-icon>
              <span>Beli Paket di WA</span>
            </a>
          } @else {
            <a
              routerLink="/servers/new"
              class="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <mat-icon class="text-sm">add</mat-icon>
              <span>Create Server</span>
            </a>
          }
        </div>
      </div>

      <!-- Filter Controls & Search -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-neutral-900/60 border border-neutral-800 rounded">
        <div class="relative flex-1 max-w-sm">
          <mat-icon class="absolute left-3 top-2.5 text-sm text-neutral-500">search</mat-icon>
          <input
            type="text"
            [formControl]="searchControl"
            placeholder="Search servers by name, ID, or runtime..."
            class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none transition-all font-mono"
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

      <!-- Server List (Pterodactyl's actual dashboard uses a row-card list,
           not a data table with column headers -- ServerRow.tsx) -->
      <div class="space-y-2">
        @if (loading() && servers().length === 0) {
          <div class="p-8 text-center text-neutral-400 bg-neutral-700 rounded">
            <mat-icon class="text-xl animate-spin mb-1">refresh</mat-icon>
            <div>Connecting to Render API...</div>
          </div>
        } @else if (filteredServers().length === 0) {
          <div class="p-8 text-center text-neutral-300 bg-neutral-700 rounded">
            @if (hasNoQuota()) {
              <div class="max-w-md mx-auto space-y-3 py-2">
                <div class="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                  <mat-icon class="text-2xl">lock</mat-icon>
                </div>
                <div>
                  <div class="text-sm font-semibold text-neutral-50">Akun Belum Memiliki Kuota Server</div>
                  <div class="text-xs text-neutral-300 mt-1 leading-relaxed">
                    Anda belum membeli paket server atau kuota Anda masih 0 server. Silakan hubungi Admin di WhatsApp untuk membeli dan mengaktifkan paket hosting.
                  </div>
                </div>
                <div class="flex items-center justify-center gap-2 pt-2">
                  <a
                    [href]="buyQuotaWaUrl()"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-blue-50 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <mat-icon class="text-sm">chat</mat-icon>
                    <span>Chat WA Admin (+62 {{ platformConfig.adminWhatsApp().display }})</span>
                  </a>
                  <a routerLink="/plans" class="px-3 py-1.5 rounded border border-neutral-500 text-neutral-200 text-xs font-medium cursor-pointer">
                    Lihat Paket
                  </a>
                </div>
              </div>
            } @else {
              <div class="text-neutral-400">No matching servers found.</div>
            }
          </div>
        } @else {
          @for (server of filteredServers(); track server.id) {
            <a
              [routerLink]="['/servers', server.id, 'console']"
              class="relative grid grid-cols-12 gap-4 items-center rounded no-underline text-neutral-200 bg-neutral-700 p-4 border border-transparent hover:border-neutral-500 transition-colors duration-150 overflow-hidden"
            >
              <div class="col-span-12 sm:col-span-5 lg:col-span-4 flex items-center">
                <div class="icon mr-4 rounded-full w-11 h-11 shrink-0 flex items-center justify-center bg-neutral-500">
                  <mat-icon class="text-neutral-100">dns</mat-icon>
                </div>
                <div class="min-w-0">
                  <p class="text-base text-neutral-50 truncate">{{ server.name }}</p>
                  <p class="text-xs text-neutral-300 truncate">{{ server.renderServiceId }}</p>
                </div>
              </div>

              <div class="hidden sm:flex col-span-2 items-center justify-center gap-1.5 text-neutral-400">
                <mat-icon class="text-sm">memory</mat-icon>
                <span class="text-xs font-mono capitalize">{{ server.runtime }}</span>
              </div>

              <div class="hidden sm:flex col-span-4 items-baseline justify-center">
                <app-status-badge [status]="server.status"></app-status-badge>
              </div>

              <div class="hidden lg:flex col-span-2 items-center justify-end gap-1">
                <button
                  type="button"
                  (click)="deploy(server); $event.preventDefault(); $event.stopPropagation()"
                  title="Deploy on Render"
                  class="p-1.5 rounded hover:bg-neutral-600 text-neutral-300 hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <mat-icon class="text-sm">rocket_launch</mat-icon>
                </button>
                <button
                  type="button"
                  (click)="restart(server); $event.preventDefault(); $event.stopPropagation()"
                  title="Restart Render Service"
                  class="p-1.5 rounded hover:bg-neutral-600 text-neutral-300 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <mat-icon class="text-sm">restart_alt</mat-icon>
                </button>
              </div>

              <!-- Status bar strip on the far right edge, matches ServerRow.tsx -->
              <div
                class="absolute right-0 top-1 bottom-1 w-2 rounded-full opacity-50"
                [class.bg-green-500]="server.status === 'ONLINE'"
                [class.bg-amber-500]="server.status === 'DEPLOYING' || server.status === 'BUILDING' || server.status === 'CREATING'"
                [class.bg-red-500]="server.status === 'FAILED' || server.status === 'SUSPENDED'"
                [class.bg-neutral-500]="server.status === 'UNKNOWN'"
              ></div>
            </a>
          }
        }
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
