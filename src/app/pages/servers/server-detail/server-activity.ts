import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { ActivityLogItem } from '../../../core/models/index.js';
import { AuthService } from '../../../core/services/auth.service.js';
import { ToastService } from '../../../core/services/toast.service.js';

@Component({
  selector: 'app-server-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <mat-icon class="text-emerald-400 text-base">history</mat-icon>
            <span>Server Activity &amp; Audit Trail</span>
          </h2>
          <p class="text-xs text-neutral-400 mt-0.5">
            Audit history of deployments, restarts, environment modifications, and file updates.
          </p>
        </div>

        <button
          type="button"
          (click)="loadActivities()"
          class="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
        >
          <mat-icon class="text-sm" [class.animate-spin]="loading()">refresh</mat-icon>
        </button>
      </div>

      <div class="rounded-xl border border-neutral-800 bg-neutral-900/40 divide-y divide-neutral-800/60 overflow-hidden font-mono text-xs">
        @if (loading() && activities().length === 0) {
          <div class="p-8 text-center text-neutral-500 font-sans">
            <mat-icon class="text-xl animate-spin mb-1">refresh</mat-icon>
            <div>Loading activity logs...</div>
          </div>
        } @else if (activities().length === 0) {
          <div class="p-8 text-center text-neutral-500 font-sans italic">
            No activity recorded on this server yet.
          </div>
        } @else {
          @for (log of activities(); track log.id) {
            <div class="p-3.5 flex items-start gap-3 hover:bg-neutral-800/30 transition-colors">
              <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5"></div>
              <div class="flex-1 min-w-0">
                <div class="text-neutral-200 font-medium font-sans">{{ log.details }}</div>
                <div class="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                  <span class="text-neutral-400 font-semibold">{{ log.action }}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{{ log.username }}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span class="tabular-nums">{{ log.timestamp.slice(0, 19).replace('T', ' ') }}</span>
                </div>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class ServerActivity implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  serverId = signal<string>('');
  activities = signal<ActivityLogItem[]>([]);
  loading = signal<boolean>(false);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.serverId.set(id);
        this.loadActivities();
      }
    });
  }

  async loadActivities() {
    this.loading.set(true);
    try {
      const headers = this.auth.getAuthHeaders();
      const res = await fetch(`/api/v1/activity?serverId=${this.serverId()}&limit=50`, { headers });
      if (res.ok) {
        const json = await res.json();
        this.activities.set(json.data || []);
      }
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to load activity logs.');
    } finally {
      this.loading.set(false);
    }
  }
}
