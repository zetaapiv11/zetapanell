import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { RenderDeployItem } from '../../../core/models/index.js';
import { ServerService } from '../../../core/services/server.service.js';
import { ToastService } from '../../../core/services/toast.service.js';
import { StatusBadge } from '../../../shared/components/status-badge.js';

@Component({
  selector: 'app-server-deployments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, StatusBadge],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <mat-icon class="text-emerald-400 text-base">cloud_sync</mat-icon>
            <span>Render Deployments</span>
          </h2>
          <p class="text-xs text-neutral-400 mt-0.5">
            Real deployment history retrieved directly from Render API.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="loadDeployments()"
            [disabled]="loading()"
            class="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
            title="Refresh Deployments"
          >
            <mat-icon class="text-sm" [class.animate-spin]="loading()">refresh</mat-icon>
          </button>

          <button
            type="button"
            (click)="triggerDeploy(false)"
            [disabled]="deploying()"
            class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <mat-icon class="text-sm">rocket_launch</mat-icon>
            <span>Trigger Deploy</span>
          </button>

          <button
            type="button"
            (click)="triggerDeploy(true)"
            [disabled]="deploying()"
            class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Deploy without using build cache"
          >
            <mat-icon class="text-sm">cleaning_services</mat-icon>
            <span>Clear Cache &amp; Deploy</span>
          </button>
        </div>
      </div>

      <!-- Deployments Table -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden font-mono text-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400 text-[11px] uppercase tracking-wider">
                <th class="py-2.5 px-4">Deployment ID</th>
                <th class="py-2.5 px-4">Status</th>
                <th class="py-2.5 px-4">Trigger / Commit</th>
                <th class="py-2.5 px-4">Created</th>
                <th class="py-2.5 px-4">Finished</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-800/60 text-neutral-300">
              @if (loading() && deployments().length === 0) {
                <tr>
                  <td colspan="5" class="p-8 text-center text-neutral-500 font-sans">
                    <mat-icon class="text-xl animate-spin mb-1">refresh</mat-icon>
                    <div>Connecting to Render deployment API...</div>
                  </td>
                </tr>
              } @else if (deployments().length === 0) {
                <tr>
                  <td colspan="5" class="p-8 text-center text-neutral-500 italic font-sans">
                    No deployments recorded yet on this service.
                  </td>
                </tr>
              } @else {
                @for (dep of deployments(); track dep.id) {
                  <tr class="hover:bg-neutral-800/30 transition-colors">
                    <td class="py-3 px-4 font-semibold text-white">
                      {{ dep.id }}
                    </td>
                    <td class="py-3 px-4">
                      <app-status-badge [status]="dep.status.toUpperCase()"></app-status-badge>
                    </td>
                    <td class="py-3 px-4 text-neutral-300">
                      <div>{{ dep.trigger || 'manual' }}</div>
                      @if (dep.commit) {
                        <div class="text-[10px] text-neutral-500 truncate max-w-xs">
                          {{ dep.commit.message || dep.commit.id }}
                        </div>
                      }
                    </td>
                    <td class="py-3 px-4 text-neutral-400 text-[11px] tabular-nums">
                      {{ dep.createdAt.slice(0, 16).replace('T', ' ') }}
                    </td>
                    <td class="py-3 px-4 text-neutral-400 text-[11px] tabular-nums">
                      {{ dep.finishedAt ? dep.finishedAt.slice(0, 16).replace('T', ' ') : '-' }}
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
export class ServerDeployments implements OnInit {
  private route = inject(ActivatedRoute);
  private serverService = inject(ServerService);
  private toast = inject(ToastService);

  serverId = signal<string>('');
  deployments = signal<RenderDeployItem[]>([]);
  loading = signal<boolean>(false);
  deploying = signal<boolean>(false);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.serverId.set(id);
        this.loadDeployments();
      }
    });
  }

  async loadDeployments() {
    this.loading.set(true);
    try {
      const data = await this.serverService.getDeploys(this.serverId());
      this.deployments.set(data);
    } catch (err: any) {
      this.toast.error(err.message || 'Could not load Render deployments.');
    } finally {
      this.loading.set(false);
    }
  }

  async triggerDeploy(clearCache = false) {
    this.deploying.set(true);
    try {
      this.toast.info('Triggering deployment on Render...');
      await this.serverService.deploy(this.serverId(), clearCache);
      this.toast.success('Deployment initiated on Render!');
      this.loadDeployments();
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to trigger deploy.');
    } finally {
      this.deploying.set(false);
    }
  }
}
