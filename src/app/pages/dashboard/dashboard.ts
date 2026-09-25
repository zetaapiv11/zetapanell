import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ActivityLogItem, ServerItem } from '../../core/models/index.js';
import { AuthService } from '../../core/services/auth.service.js';
import { ServerService } from '../../core/services/server.service.js';
import { ToastService } from '../../core/services/toast.service.js';
import { StatusBadge } from '../../shared/components/status-badge.js';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, StatusBadge],
  template: `
    <div class="space-y-6">
      <!-- Welcome Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-white">Dashboard Overview</h1>
          <p class="text-xs text-neutral-400 mt-0.5">
            Active workspace &amp; infrastructure monitoring powered by Render API.
          </p>
        </div>
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="refreshData()"
            [disabled]="loading()"
            class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <mat-icon class="text-sm" [class.animate-spin]="loading()">refresh</mat-icon>
            <span>Sync Render</span>
          </button>
          <a
            routerLink="/servers/new"
            class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <mat-icon class="text-sm">add</mat-icon>
            <span>Create Server</span>
          </a>
        </div>
      </div>

      <!-- Metric Grid (Tabular Numerals, Clean Single Elevation) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col justify-between">
          <div class="flex items-center justify-between text-neutral-400 mb-2">
            <span class="text-xs font-medium">Total Servers</span>
            <mat-icon class="text-base text-neutral-500">dns</mat-icon>
          </div>
          <div class="text-2xl font-bold font-mono tabular-nums text-white">
            {{ servers().length }}
          </div>
          <div class="mt-2 text-[11px] text-neutral-500">Quota: {{ auth.user()?.maxServers }} allocated</div>
        </div>

        <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col justify-between">
          <div class="flex items-center justify-between text-neutral-400 mb-2">
            <span class="text-xs font-medium">Online Services</span>
            <mat-icon class="text-base text-emerald-400">check_circle</mat-icon>
          </div>
          <div class="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {{ onlineCount() }}
          </div>
          <div class="mt-2 text-[11px] text-neutral-500">Reporting live healthy state</div>
        </div>

        <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col justify-between">
          <div class="flex items-center justify-between text-neutral-400 mb-2">
            <span class="text-xs font-medium">Building / Deploying</span>
            <mat-icon class="text-base text-amber-400">sync</mat-icon>
          </div>
          <div class="text-2xl font-bold font-mono tabular-nums text-amber-400">
            {{ buildingCount() }}
          </div>
          <div class="mt-2 text-[11px] text-neutral-500">Active pipeline builds</div>
        </div>

        <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col justify-between">
          <div class="flex items-center justify-between text-neutral-400 mb-2">
            <span class="text-xs font-medium">Cloudflare R2 Storage</span>
            <mat-icon class="text-base text-neutral-500">cloud_done</mat-icon>
          </div>
          <div class="text-2xl font-bold font-mono tabular-nums text-white">
            S3 Ready
          </div>
          <div class="mt-2 text-[11px] text-neutral-500">Limit: {{ auth.user()?.maxStorageMb }} MB</div>
        </div>
      </div>

      <!-- Main Layout: Server Grid & Recent Stream -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Servers Section (2 cols on large screen) -->
        <div class="lg:col-span-2 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <mat-icon class="text-base text-neutral-400">layers</mat-icon>
              <span>Your Managed Servers</span>
            </h2>
            <a routerLink="/servers" class="text-xs text-emerald-400 hover:underline">View all &rarr;</a>
          </div>

          @if (loading() && servers().length === 0) {
            <div class="p-12 text-center rounded-xl border border-neutral-800/80 bg-neutral-900/40 text-neutral-500 text-xs">
              <mat-icon class="text-2xl animate-spin mb-2">refresh</mat-icon>
              <div>Querying Render API infrastructure...</div>
            </div>
          } @else if (servers().length === 0) {
            <div class="p-10 text-center rounded-xl border border-dashed border-neutral-800 bg-neutral-900/20 text-neutral-400 space-y-3">
              <mat-icon class="text-3xl text-neutral-600">terminal</mat-icon>
              <div class="text-xs font-medium text-neutral-300">No servers deployed yet</div>
              <p class="text-[11px] text-neutral-500 max-w-sm mx-auto">
                Provision your first real Render service (Discord bot, Web service, or Worker) backed by Cloudflare R2 storage.
              </p>
              <a
                routerLink="/servers/new"
                class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                <mat-icon class="text-sm">add</mat-icon>
                <span>Create Server</span>
              </a>
            </div>
          } @else {
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              @for (server of servers(); track server.id) {
                <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/70 hover:border-neutral-700 transition-all flex flex-col justify-between group">
                  <div>
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <a
                        [routerLink]="['/servers', server.id, 'console']"
                        class="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors truncate"
                      >
                        {{ server.name }}
                      </a>
                      <app-status-badge [status]="server.status"></app-status-badge>
                    </div>

                    <!-- Clean unboxed metadata with separators -->
                    <div class="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                      <span>{{ server.runtime }}</span>
                      <span aria-hidden="true" class="text-neutral-600">&middot;</span>
                      <span>{{ server.serviceType }}</span>
                      <span aria-hidden="true" class="text-neutral-600">&middot;</span>
                      <span>{{ server.region }}</span>
                    </div>

                    @if (server.serviceUrl) {
                      <div class="mt-2 text-[11px] truncate">
                        <a
                          [href]="server.serviceUrl"
                          target="_blank"
                          rel="noopener"
                          class="text-neutral-400 hover:text-emerald-400 font-mono flex items-center gap-1"
                        >
                          <mat-icon class="text-xs">open_in_new</mat-icon>
                          <span>{{ server.serviceUrl }}</span>
                        </a>
                      </div>
                    }
                  </div>

                  <div class="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                    <span class="text-[10px] text-neutral-500 font-mono truncate">
                      ID: {{ server.renderServiceId.slice(0, 14) }}
                    </span>
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        (click)="deployServer(server)"
                        title="Trigger Deploy on Render"
                        class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        <mat-icon class="text-sm">rocket_launch</mat-icon>
                      </button>
                      <button
                        type="button"
                        (click)="restartServer(server)"
                        title="Restart Render Service"
                        class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                      >
                        <mat-icon class="text-sm">restart_alt</mat-icon>
                      </button>
                      <a
                        [routerLink]="['/servers', server.id, 'console']"
                        class="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-medium transition-colors"
                      >
                        Manage
                      </a>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Recent Activity Column -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <mat-icon class="text-base text-neutral-400">history</mat-icon>
              <span>Recent Activity</span>
            </h2>
            <a routerLink="/activity" class="text-xs text-neutral-400 hover:text-neutral-200">View all &rarr;</a>
          </div>

          <div class="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800/70 overflow-hidden">
            @if (activities().length === 0) {
              <div class="p-6 text-center text-xs text-neutral-500">
                No activity recorded yet.
              </div>
            } @else {
              @for (act of activities(); track act.id) {
                <div class="p-3 text-xs flex items-start gap-2.5">
                  <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5"></div>
                  <div class="flex-1 min-w-0">
                    <div class="text-neutral-200 font-medium truncate">{{ act.details }}</div>
                    <div class="flex items-center gap-2 text-[10px] text-neutral-500 font-mono mt-0.5">
                      <span>{{ act.username }}</span>
                      <span aria-hidden="true">&middot;</span>
                      <span>{{ act.timestamp.slice(11, 19) }}</span>
                    </div>
                  </div>
                </div>
              }
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Dashboard implements OnInit {
  private serverService = inject(ServerService);
  private toast = inject(ToastService);
  readonly auth = inject(AuthService);

  servers = signal<ServerItem[]>([]);
  activities = signal<ActivityLogItem[]>([]);
  loading = signal<boolean>(false);

  onlineCount = signal(0);
  buildingCount = signal(0);

  ngOnInit() {
    this.refreshData();
  }

  async refreshData() {
    this.loading.set(true);
    try {
      const data = await this.serverService.getServers();
      this.servers.set(data);

      this.onlineCount.set(data.filter((s) => s.status === 'ONLINE').length);
      this.buildingCount.set(
        data.filter((s) => s.status === 'BUILDING' || s.status === 'DEPLOYING').length
      );

      // Fetch recent user activity
      const headers = this.auth.getAuthHeaders();
      const res = await fetch('/api/v1/activity?limit=6', { headers });
      if (res.ok) {
        const json = await res.json();
        this.activities.set(json.data || []);
      }
    } catch (err: any) {
      this.toast.error(err.message || 'Could not load servers from Render API.');
    } finally {
      this.loading.set(false);
    }
  }

  async deployServer(server: ServerItem) {
    try {
      this.toast.info(`Triggering Render deployment for ${server.name}...`);
      await this.serverService.deploy(server.id, false);
      this.toast.success(`Deploy initiated on Render for ${server.name}!`);
      this.refreshData();
    } catch (err: any) {
      this.toast.error(err.message || 'Deploy trigger failed.');
    }
  }

  async restartServer(server: ServerItem) {
    try {
      this.toast.info(`Sending restart command to Render for ${server.name}...`);
      await this.serverService.restart(server.id);
      this.toast.success(`Restart request sent for ${server.name}!`);
      this.refreshData();
    } catch (err: any) {
      this.toast.error(err.message || 'Restart failed.');
    }
  }
}
