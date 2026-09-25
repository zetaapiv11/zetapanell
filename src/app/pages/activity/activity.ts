import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivityLogItem } from '../../core/models/index.js';
import { AuthService } from '../../core/services/auth.service.js';
import { ToastService } from '../../core/services/toast.service.js';

@Component({
  selector: 'app-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-white">System Activity Logs</h1>
          <p class="text-xs text-neutral-400 mt-0.5">
            Full audit log of operations across your account and managed servers.
          </p>
        </div>

        <button
          type="button"
          (click)="loadLogs()"
          [disabled]="loading()"
          class="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
        >
          <mat-icon class="text-sm" [class.animate-spin]="loading()">refresh</mat-icon>
        </button>
      </div>

      <!-- Activity Stream Table -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/40 divide-y divide-neutral-800/60 overflow-hidden font-mono text-xs">
        @if (loading() && logs().length === 0) {
          <div class="p-8 text-center text-neutral-500 font-sans">
            <mat-icon class="text-xl animate-spin mb-1">refresh</mat-icon>
            <div>Loading activity records...</div>
          </div>
        } @else if (logs().length === 0) {
          <div class="p-8 text-center text-neutral-500 font-sans italic">
            No activity logged yet.
          </div>
        } @else {
          @for (item of logs(); track item.id) {
            <div class="p-3.5 flex items-start gap-3 hover:bg-neutral-800/30 transition-colors">
              <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5"></div>
              <div class="flex-1 min-w-0 font-sans">
                <div class="text-neutral-200 font-medium text-xs">{{ item.details }}</div>
                <div class="flex items-center gap-2 text-[11px] text-neutral-500 font-mono mt-0.5">
                  <span class="text-neutral-400 font-semibold">{{ item.action }}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{{ item.username }}</span>
                  @if (item.serverName) {
                    <span aria-hidden="true">&middot;</span>
                    <span class="text-emerald-400">{{ item.serverName }}</span>
                  }
                  <span aria-hidden="true">&middot;</span>
                  <span class="tabular-nums">{{ item.timestamp.slice(0, 19).replace('T', ' ') }}</span>
                </div>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class Activity implements OnInit {
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  logs = signal<ActivityLogItem[]>([]);
  loading = signal<boolean>(false);

  ngOnInit() {
    this.loadLogs();
  }

  async loadLogs() {
    this.loading.set(true);
    try {
      const headers = this.auth.getAuthHeaders();
      const res = await fetch('/api/v1/activity?limit=100', { headers });
      if (res.ok) {
        const json = await res.json();
        this.logs.set(json.data || []);
      }
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to load activity logs.');
    } finally {
      this.loading.set(false);
    }
  }
}
