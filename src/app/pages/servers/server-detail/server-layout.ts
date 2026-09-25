import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ServerItem } from '../../../core/models/index.js';
import { ServerService } from '../../../core/services/server.service.js';
import { ToastService } from '../../../core/services/toast.service.js';
import { StatusBadge } from '../../../shared/components/status-badge.js';

@Component({
  selector: 'app-server-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, StatusBadge],
  template: `
    @if (loading() && !server()) {
      <div class="p-16 text-center text-neutral-500 text-xs">
        <mat-icon class="text-2xl animate-spin mb-2">refresh</mat-icon>
        <div>Connecting to Render API...</div>
      </div>
    } @else if (server()) {
      <div class="space-y-5">
        <!-- Server Header (Pterodactyl-inspired) -->
        <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center font-mono font-bold text-lg text-emerald-400 shrink-0">
              {{ server()!.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-lg font-bold tracking-tight text-white">{{ server()!.name }}</h1>
                <app-status-badge [status]="server()!.status"></app-status-badge>
              </div>

              <!-- Unboxed metadata with subtle dots -->
              <div class="flex flex-wrap items-center gap-2 text-xs text-neutral-400 font-mono mt-1">
                <span>{{ server()!.runtime }}</span>
                <span aria-hidden="true" class="text-neutral-600">&middot;</span>
                <span>{{ server()!.serviceType }}</span>
                <span aria-hidden="true" class="text-neutral-600">&middot;</span>
                <span>{{ server()!.region }}</span>
                <span aria-hidden="true" class="text-neutral-600">&middot;</span>
                <span class="text-neutral-500">{{ server()!.renderServiceId }}</span>
                @if (server()!.serviceUrl) {
                  <span aria-hidden="true" class="text-neutral-600">&middot;</span>
                  <a
                    [href]="server()!.serviceUrl"
                    target="_blank"
                    rel="noopener"
                    class="text-emerald-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Visit</span>
                    <mat-icon class="text-[10px]">open_in_new</mat-icon>
                  </a>
                }
              </div>
            </div>
          </div>

          <!-- Quick Actions Bar -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="triggerDeploy()"
              [disabled]="actionLoading()"
              class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <mat-icon class="text-sm">rocket_launch</mat-icon>
              <span>Deploy</span>
            </button>

            <button
              type="button"
              (click)="triggerRestart()"
              [disabled]="actionLoading()"
              class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <mat-icon class="text-sm">restart_alt</mat-icon>
              <span>Restart</span>
            </button>

            @if (server()!.status === 'SUSPENDED') {
              <button
                type="button"
                (click)="toggleSuspend(false)"
                [disabled]="actionLoading()"
                class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <mat-icon class="text-sm">play_arrow</mat-icon>
                <span>Resume</span>
              </button>
            } @else {
              <button
                type="button"
                (click)="toggleSuspend(true)"
                [disabled]="actionLoading()"
                class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-neutral-400 hover:text-amber-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <mat-icon class="text-sm">pause</mat-icon>
                <span>Suspend</span>
              </button>
            }

            <a
              [routerLink]="['/servers', server()!.id, 'settings']"
              class="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Server Settings"
            >
              <mat-icon class="text-sm">settings</mat-icon>
            </a>
          </div>
        </div>

        <!-- Sub-Navigation Tabs (Pterodactyl-Style) -->
        <div class="flex items-center gap-1 border-b border-neutral-800 text-xs font-medium overflow-x-auto">
          <a
            [routerLink]="['/servers', server()!.id, 'console']"
            routerLinkActive="text-emerald-400 border-emerald-400 bg-neutral-900/40"
            class="px-3.5 py-2.5 border-b-2 border-transparent text-neutral-400 hover:text-neutral-200 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <mat-icon class="text-sm">terminal</mat-icon>
            <span>Console</span>
          </a>

          <a
            [routerLink]="['/servers', server()!.id, 'files']"
            routerLinkActive="text-emerald-400 border-emerald-400 bg-neutral-900/40"
            class="px-3.5 py-2.5 border-b-2 border-transparent text-neutral-400 hover:text-neutral-200 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <mat-icon class="text-sm">folder</mat-icon>
            <span>Files (R2)</span>
          </a>

          <a
            [routerLink]="['/servers', server()!.id, 'startup']"
            routerLinkActive="text-emerald-400 border-emerald-400 bg-neutral-900/40"
            class="px-3.5 py-2.5 border-b-2 border-transparent text-neutral-400 hover:text-neutral-200 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <mat-icon class="text-sm">play_circle</mat-icon>
            <span>Startup</span>
          </a>

          <a
            [routerLink]="['/servers', server()!.id, 'env']"
            routerLinkActive="text-emerald-400 border-emerald-400 bg-neutral-900/40"
            class="px-3.5 py-2.5 border-b-2 border-transparent text-neutral-400 hover:text-neutral-200 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <mat-icon class="text-sm">vpn_key</mat-icon>
            <span>Environment</span>
          </a>

          <a
            [routerLink]="['/servers', server()!.id, 'deployments']"
            routerLinkActive="text-emerald-400 border-emerald-400 bg-neutral-900/40"
            class="px-3.5 py-2.5 border-b-2 border-transparent text-neutral-400 hover:text-neutral-200 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <mat-icon class="text-sm">cloud_sync</mat-icon>
            <span>Deployments</span>
          </a>

          <a
            [routerLink]="['/servers', server()!.id, 'activity']"
            routerLinkActive="text-emerald-400 border-emerald-400 bg-neutral-900/40"
            class="px-3.5 py-2.5 border-b-2 border-transparent text-neutral-400 hover:text-neutral-200 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <mat-icon class="text-sm">history</mat-icon>
            <span>Activity</span>
          </a>

          <a
            [routerLink]="['/servers', server()!.id, 'settings']"
            routerLinkActive="text-emerald-400 border-emerald-400 bg-neutral-900/40"
            class="px-3.5 py-2.5 border-b-2 border-transparent text-neutral-400 hover:text-neutral-200 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <mat-icon class="text-sm">settings</mat-icon>
            <span>Settings</span>
          </a>
        </div>

        <!-- Tab Content Outlet -->
        <div>
          <router-outlet></router-outlet>
        </div>
      </div>
    }
  `,
})
export class ServerLayout implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serverService = inject(ServerService);
  private toast = inject(ToastService);

  server = signal<ServerItem | null>(null);
  loading = signal<boolean>(true);
  actionLoading = signal<boolean>(false);

  private pollInterval?: any;

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadServer(id);
      }
    });

    // Refresh server status every 15 seconds
    this.pollInterval = setInterval(() => {
      const current = this.server();
      if (current) {
        this.serverService.getStatus(current.id).then((statusRes) => {
          this.server.update((s) => (s ? { ...s, status: statusRes.status as any } : null));
        }).catch(() => {});
      }
    }, 15000);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  async loadServer(id: string) {
    this.loading.set(true);
    try {
      const data = await this.serverService.getServer(id);
      this.server.set(data);
    } catch (err: any) {
      this.toast.error(err.message || 'Could not load server.');
      this.router.navigate(['/servers']);
    } finally {
      this.loading.set(false);
    }
  }

  async triggerDeploy() {
    const s = this.server();
    if (!s) return;
    this.actionLoading.set(true);
    try {
      this.toast.info(`Deploying ${s.name} on Render...`);
      await this.serverService.deploy(s.id, false);
      this.toast.success('Render deployment triggered!');
      this.server.update((srv) => (srv ? { ...srv, status: 'DEPLOYING' } : null));
    } catch (err: any) {
      this.toast.error(err.message || 'Deploy trigger failed.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async triggerRestart() {
    const s = this.server();
    if (!s) return;
    this.actionLoading.set(true);
    try {
      this.toast.info(`Restarting ${s.name}...`);
      await this.serverService.restart(s.id);
      this.toast.success('Restart command sent to Render.');
    } catch (err: any) {
      this.toast.error(err.message || 'Restart failed.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async toggleSuspend(suspend: boolean) {
    const s = this.server();
    if (!s) return;
    this.actionLoading.set(true);
    try {
      if (suspend) {
        await this.serverService.suspend(s.id);
        this.toast.success('Server suspended.');
        this.server.update((srv) => (srv ? { ...srv, status: 'SUSPENDED' } : null));
      } else {
        await this.serverService.resume(s.id);
        this.toast.success('Server resumed.');
        this.server.update((srv) => (srv ? { ...srv, status: 'ONLINE' } : null));
      }
    } catch (err: any) {
      this.toast.error(err.message || 'Suspend/Resume failed.');
    } finally {
      this.actionLoading.set(false);
    }
  }
}
