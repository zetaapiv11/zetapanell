import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ServerItem } from '../../../core/models/index.js';
import { ServerService } from '../../../core/services/server.service.js';
import { ToastService } from '../../../core/services/toast.service.js';
import { StatusBadge } from '../../../shared/components/status-badge.js';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-server-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, StatusBadge],
  template: `
    @if (loading() && !server()) {
      <div class="p-16 text-center text-neutral-400 text-xs">
        <mat-icon class="text-2xl animate-spin mb-2">refresh</mat-icon>
        <div>Menghubungkan ke Render...</div>
      </div>
    } @else if (server()) {
      <div class="space-y-0">
        <!-- Server Header: name/description left, Power Buttons right
             (mirrors Pterodactyl's ServerConsoleContainer header row) -->
        <div class="px-1 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="text-xl font-medium tracking-normal text-neutral-50 truncate">{{ server()!.name }}</h1>
              <app-status-badge [status]="server()!.status"></app-status-badge>
            </div>
            <p class="text-sm text-neutral-300 truncate mt-0.5">
              {{ server()!.runtime }} &middot; {{ server()!.region }}
              @if (server()!.serviceUrl) {
                &middot;
                <a [href]="server()!.serviceUrl" target="_blank" rel="noopener" class="text-blue-400 hover:underline">
                  Buka URL
                </a>
              }
            </p>
          </div>

          <!-- Power Controls: Start (primary/blue) / Restart (text/gray) / Stop (danger/red) --
               same three-button grouping and coloring as Pterodactyl's PowerButtons.tsx -->
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              (click)="handleStart()"
              [disabled]="actionLoading() || (server()!.status !== 'SUSPENDED' && isBusyStatus())"
              class="px-4 py-2 rounded text-sm font-semibold transition-all duration-100 cursor-pointer
                     bg-blue-600 text-blue-50 hover:bg-blue-500 disabled:bg-blue-500/75 disabled:text-blue-200/75 disabled:cursor-not-allowed"
            >
              Start
            </button>

            <button
              type="button"
              (click)="handleRestart()"
              [disabled]="actionLoading() || server()!.status === 'SUSPENDED'"
              class="px-4 py-2 rounded text-sm font-semibold transition-all duration-100 cursor-pointer
                     bg-neutral-500 text-neutral-50 hover:bg-neutral-400 disabled:bg-neutral-500/75 disabled:text-neutral-200/75 disabled:cursor-not-allowed"
            >
              Restart
            </button>

            <button
              type="button"
              (click)="handleStop()"
              [disabled]="actionLoading() || server()!.status === 'SUSPENDED'"
              class="px-4 py-2 rounded text-sm font-semibold transition-all duration-100 cursor-pointer
                     bg-red-600 text-neutral-50 hover:bg-red-500 disabled:bg-red-600/75 disabled:text-red-50/75 disabled:cursor-not-allowed"
            >
              Stop
            </button>
          </div>
        </div>

        <!-- Sub-Navigation: horizontal bar, cyan underline on the active tab
             (matches Pterodactyl's SubNavigation.tsx exactly, not a sidebar) -->
        <div class="w-full bg-neutral-700 shadow overflow-x-auto -mx-1 px-1">
          <div class="flex items-center text-sm">
            @for (item of navItems; track item.path) {
              <a
                [routerLink]="['/servers', server()!.id, item.path]"
                routerLinkActive="text-neutral-100 shadow-[inset_0_-2px_0_var(--color-cyan-500)]"
                class="inline-flex items-center gap-1.5 py-3 px-4 text-neutral-300 no-underline whitespace-nowrap transition-all duration-150 hover:text-neutral-100 cursor-pointer"
              >
                <mat-icon class="text-base">{{ item.icon }}</mat-icon>
                <span>{{ item.label }}</span>
              </a>
            }
          </div>
        </div>

        <!-- Tab Content Outlet -->
        <div class="pt-4">
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

  // Beginner-friendly labels: plain wording over Render/dev jargon where
  // possible ("Log Deploy" instead of "Deployments", etc.) so someone new to
  // bot hosting doesn't need to guess what each tab does.
  readonly navItems: NavItem[] = [
    { path: 'console', label: 'Console', icon: 'terminal' },
    { path: 'files', label: 'File Manager', icon: 'folder' },
    { path: 'monitor', label: 'Monitor', icon: 'monitor_heart' },
    { path: 'startup', label: 'Startup', icon: 'play_circle' },
    { path: 'env', label: 'Environment', icon: 'vpn_key' },
    { path: 'deployments', label: 'Log Deploy', icon: 'cloud_sync' },
    { path: 'activity', label: 'Aktivitas', icon: 'history' },
    { path: 'settings', label: 'Pengaturan', icon: 'settings' },
  ];

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
        this.serverService
          .getStatus(current.id)
          .then((statusRes) => {
            this.server.update((s) => (s ? { ...s, status: statusRes.status as any } : null));
          })
          .catch(() => {});
      }
    }, 15000);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  isBusyStatus(): boolean {
    const s = this.server();
    return s?.status === 'DEPLOYING' || s?.status === 'BUILDING' || s?.status === 'CREATING';
  }

  async loadServer(id: string) {
    this.loading.set(true);
    try {
      const data = await this.serverService.getServer(id);
      this.server.set(data);
    } catch (err: any) {
      this.toast.error(err.message || 'Tidak bisa memuat data server.');
      this.router.navigate(['/servers']);
    } finally {
      this.loading.set(false);
    }
  }

  /** "Start" = resume if suspended, otherwise trigger a fresh deploy. */
  async handleStart() {
    const s = this.server();
    if (!s) return;
    if (s.status === 'SUSPENDED') {
      await this.toggleSuspend(false);
      return;
    }
    this.actionLoading.set(true);
    try {
      this.toast.info(`Menyalakan ${s.name}...`);
      await this.serverService.deploy(s.id, false);
      this.toast.success('Bot sedang di-deploy!');
      this.server.update((srv) => (srv ? { ...srv, status: 'DEPLOYING' } : null));
    } catch (err: any) {
      this.toast.error(err.message || 'Gagal menyalakan bot.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async handleRestart() {
    const s = this.server();
    if (!s) return;
    this.actionLoading.set(true);
    try {
      this.toast.info(`Me-restart ${s.name}...`);
      await this.serverService.restart(s.id);
      this.toast.success('Perintah restart terkirim ke Render.');
    } catch (err: any) {
      this.toast.error(err.message || 'Restart gagal.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async handleStop() {
    await this.toggleSuspend(true);
  }

  private async toggleSuspend(suspend: boolean) {
    const s = this.server();
    if (!s) return;
    this.actionLoading.set(true);
    try {
      if (suspend) {
        await this.serverService.suspend(s.id);
        this.toast.success('Bot dihentikan sementara (data tetap aman).');
        this.server.update((srv) => (srv ? { ...srv, status: 'SUSPENDED' } : null));
      } else {
        await this.serverService.resume(s.id);
        this.toast.success('Bot dinyalakan kembali.');
        this.server.update((srv) => (srv ? { ...srv, status: 'ONLINE' } : null));
      }
    } catch (err: any) {
      this.toast.error(err.message || 'Start/Stop gagal.');
    } finally {
      this.actionLoading.set(false);
    }
  }
}
