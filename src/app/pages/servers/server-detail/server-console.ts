import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { ResourceMetrics } from '../../../core/models/index.js';
import { ServerService } from '../../../core/services/server.service.js';
import { ToastService } from '../../../core/services/toast.service.js';
import { ServerTerminal } from './server-terminal.js';

interface StatBlockItem {
  key: string;
  label: string;
  icon: string;
  valueText: string;
  /** 'neutral' | 'warn' | 'danger' -- mirrors Pterodactyl's getBackgroundColor() */
  level: 'neutral' | 'warn' | 'danger';
}

const TIP_DISMISSED_KEY = 'zetapanel_console_tip_dismissed';

@Component({
  selector: 'app-server-console',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, ServerTerminal],
  template: `
    <div class="space-y-4">
      <!-- Beginner tip banner (Pterodactyl doesn't have this, but first-time
           WA bot hosting users usually don't know what "console" even means) -->
      @if (showTip()) {
        <div class="p-3.5 rounded border border-blue-800/40 bg-blue-950/30 flex items-start gap-2.5 text-xs text-blue-200">
          <mat-icon class="text-sm text-blue-400 mt-0.5">lightbulb</mat-icon>
          <div class="flex-1">
            <p class="font-semibold text-blue-300">Baru pertama kali pakai panel ini?</p>
            <p class="mt-0.5 text-blue-200/80">
              <strong>Console</strong> = layar buat lihat log &amp; jalanin perintah bot kamu secara langsung.
              Kalau bot error, cek di sini dulu. Tombol <strong>Start/Restart/Stop</strong> di atas buat nyala-matiin bot,
              dan tab <strong>File Manager</strong> buat upload/ganti source code.
            </p>
          </div>
          <button
            type="button"
            (click)="dismissTip()"
            class="text-blue-400 hover:text-blue-200 transition-colors cursor-pointer shrink-0"
            title="Tutup tips"
          >
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>
      }

      <!-- Mode Switcher Tabs -->
      <div class="flex items-center justify-between border-b border-neutral-700 pb-2">
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="activeMode.set('terminal')"
            class="px-3.5 py-1.5 rounded text-xs font-medium cursor-pointer transition-all flex items-center gap-2"
            [class.bg-neutral-700]="activeMode() === 'terminal'"
            [class.text-neutral-50]="activeMode() === 'terminal'"
            [class.text-neutral-400]="activeMode() !== 'terminal'"
            [class.hover:text-neutral-100]="activeMode() !== 'terminal'"
          >
            <mat-icon class="text-sm">terminal</mat-icon>
            <span class="font-semibold">Console</span>
          </button>

          <button
            type="button"
            (click)="activeMode.set('logs')"
            class="px-3.5 py-1.5 rounded text-xs font-medium cursor-pointer transition-all flex items-center gap-2"
            [class.bg-neutral-700]="activeMode() === 'logs'"
            [class.text-neutral-50]="activeMode() === 'logs'"
            [class.text-neutral-400]="activeMode() !== 'logs'"
            [class.hover:text-neutral-100]="activeMode() !== 'logs'"
          >
            <mat-icon class="text-sm">receipt_long</mat-icon>
            <span>Log Deploy</span>
          </button>
        </div>

        <div class="text-[11px] text-neutral-400 font-mono hidden sm:flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
          <span>Live</span>
        </div>
      </div>

      <!-- Mode 1: Terminal + resource sidebar (Pterodactyl ServerConsoleContainer layout) -->
      @if (activeMode() === 'terminal') {
        <div class="grid grid-cols-4 gap-2 sm:gap-4">
          <div class="col-span-4 lg:col-span-3">
            <app-server-terminal [serverId]="serverId()" [serverName]="serverName()" />
          </div>

          <!-- Resource sidebar: same 7-stat idea as Pterodactyl's ServerDetailsBlock -->
          <div class="col-span-4 lg:col-span-1 order-last lg:order-none grid grid-cols-2 lg:grid-cols-1 gap-2">
            @for (stat of stats(); track stat.key) {
              <div class="relative bg-neutral-600 rounded shadow flex items-center gap-2.5 p-2.5 overflow-hidden">
                <div
                  class="absolute left-0 top-0 bottom-0 w-1"
                  [class.bg-neutral-700]="stat.level === 'neutral'"
                  [class.bg-amber-500]="stat.level === 'warn'"
                  [class.bg-red-500]="stat.level === 'danger'"
                ></div>
                <div
                  class="w-8 h-8 rounded flex items-center justify-center shrink-0 ml-1"
                  [class.bg-neutral-700]="stat.level === 'neutral'"
                  [class.bg-amber-500]="stat.level === 'warn'"
                  [class.bg-red-500]="stat.level === 'danger'"
                >
                  <mat-icon class="text-sm text-neutral-50">{{ stat.icon }}</mat-icon>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-medium leading-tight text-[11px] text-neutral-200 truncate">{{ stat.label }}</p>
                  <div class="text-xs font-semibold text-neutral-50 truncate">{{ stat.valueText }}</div>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Mode 2: Raw Render Deploy Stream Logs -->
      @if (activeMode() === 'logs') {
        <div class="space-y-4">
          <!-- Terminal Controls Bar -->
          <div class="flex items-center justify-between bg-neutral-700 rounded-t px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono text-neutral-100 font-semibold flex items-center gap-1.5">
                <mat-icon class="text-xs text-cyan-400">subject</mat-icon>
                <span>Riwayat Deploy &amp; Event Render</span>
              </span>
              <span class="text-[10px] text-neutral-400 font-mono hidden sm:inline">&middot; Update tiap 5 detik</span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="toggleAutoScroll()"
                class="px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer"
                [class.bg-neutral-600]="autoScroll()"
                [class.text-cyan-400]="autoScroll()"
                [class.text-neutral-400]="!autoScroll()"
              >
                Auto-Scroll: {{ autoScroll() ? 'ON' : 'OFF' }}
              </button>

              <button
                type="button"
                (click)="refreshLogs()"
                class="p-1 rounded hover:bg-neutral-600 text-neutral-300 hover:text-neutral-100 transition-colors cursor-pointer"
                title="Refresh Logs"
              >
                <mat-icon class="text-sm" [class.animate-spin]="loading()">refresh</mat-icon>
              </button>

              <button
                type="button"
                (click)="clearLogs()"
                class="p-1 rounded hover:bg-neutral-600 text-neutral-300 hover:text-neutral-100 transition-colors cursor-pointer"
                title="Bersihkan tampilan"
              >
                <mat-icon class="text-sm">delete_outline</mat-icon>
              </button>
            </div>
          </div>

          <!-- Terminal Output Screen -->
          <div
            #terminalBody
            class="bg-[#131a20] rounded-b p-4 font-mono text-xs text-neutral-200 h-[480px] overflow-y-auto space-y-1 select-text shadow-inner -mt-4"
          >
            @if (logs().length === 0) {
              <div class="text-neutral-500 italic py-8 text-center">
                Menyambungkan ke Render...
              </div>
            } @else {
              @for (line of logs(); track $index) {
                <div
                  class="leading-relaxed hover:bg-white/5 px-1 rounded transition-colors break-words"
                  [class.text-red-400]="line.includes('[ERROR]')"
                  [class.text-amber-300]="line.includes('[BUILD]')"
                  [class.text-cyan-300]="line.includes('[RUNTIME]') || line.includes('[LIVE]')"
                  [class.text-blue-300]="line.includes('[RENDER]') || line.includes('[GIT]')"
                >
                  {{ line }}
                </div>
              }
            }
          </div>

          <!-- Quick Command Prompt Bar (Info) -->
          <div class="p-3 bg-neutral-700 rounded flex items-center justify-between text-xs text-neutral-300">
            <div class="flex items-center gap-2">
              <mat-icon class="text-cyan-400 text-sm">info</mat-icon>
              <span>Log ini otomatis nyambung dari Render, jadi selalu update.</span>
            </div>
            <button
              type="button"
              (click)="redeployService()"
              class="px-3 py-1.5 rounded bg-neutral-500 hover:bg-neutral-400 text-neutral-50 font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <mat-icon class="text-xs">sync</mat-icon>
              <span>Deploy Ulang</span>
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ServerConsole implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private serverService = inject(ServerService);
  private toast = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  terminalBody = viewChild<ElementRef>('terminalBody');

  serverId = signal<string>('');
  serverName = signal<string>('app');
  activeMode = signal<'terminal' | 'logs'>('terminal');

  logs = signal<string[]>([]);
  loading = signal<boolean>(false);
  autoScroll = signal<boolean>(true);
  showTip = signal<boolean>(false);
  stats = signal<StatBlockItem[]>(this.placeholderStats());

  private pollInterval?: any;
  private metricsInterval?: any;

  ngOnInit() {
    this.route.parent?.paramMap.subscribe(async (params) => {
      const id = params.get('id');
      if (id) {
        this.serverId.set(id);
        this.refreshLogs();
        this.refreshStats();

        try {
          const s = await this.serverService.getServer(id);
          if (s) {
            this.serverName.set(s.name);
          }
        } catch {
          // Ignore fallback name
        }
      }
    });

    // Auto-poll Render logs every 5 seconds
    this.pollInterval = setInterval(() => {
      if (this.serverId() && this.activeMode() === 'logs') {
        this.refreshLogs(true);
      }
    }, 5000);

    // Auto-poll resource stats every 10 seconds
    this.metricsInterval = setInterval(() => this.refreshStats(), 10000);

    if (isPlatformBrowser(this.platformId)) {
      try {
        this.showTip.set(localStorage.getItem(TIP_DISMISSED_KEY) !== '1');
      } catch {
        this.showTip.set(true);
      }
    }
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
  }

  dismissTip() {
    this.showTip.set(false);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(TIP_DISMISSED_KEY, '1');
      } catch {
        // Ignore storage errors (private browsing, etc.)
      }
    }
  }

  async refreshStats() {
    if (!this.serverId()) return;
    try {
      const data = await this.serverService.getMetrics(this.serverId(), 30);
      this.stats.set(this.buildStats(data));
    } catch {
      // Silent -- the full Monitor tab surfaces errors; this sidebar just
      // keeps showing its last known values (or placeholders) if a poll fails.
    }
  }

  private levelFor(percent: number | null): 'neutral' | 'warn' | 'danger' {
    if (percent === null) return 'neutral';
    if (percent > 90) return 'danger';
    if (percent > 80) return 'warn';
    return 'neutral';
  }

  private buildStats(data: ResourceMetrics): StatBlockItem[] {
    const fmtBytes = (b: number | null) => {
      if (b === null) return 'N/A';
      if (b === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
      return `${(b / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    };
    const diskPercent =
      data.diskUsedBytes !== null && data.diskCapacityBytes
        ? Math.round((data.diskUsedBytes / data.diskCapacityBytes) * 100)
        : null;

    return [
      {
        key: 'cpu',
        label: 'CPU Load',
        icon: 'memory',
        valueText: data.cpuPercent !== null ? `${data.cpuPercent}%` : 'N/A',
        level: this.levelFor(data.cpuPercent),
      },
      {
        key: 'ram',
        label: 'Memory',
        icon: 'developer_board',
        valueText: fmtBytes(data.memoryBytes),
        level: 'neutral',
      },
      {
        key: 'disk',
        label: 'Disk',
        icon: 'storage',
        valueText: data.diskUsedBytes !== null ? fmtBytes(data.diskUsedBytes) : 'N/A',
        level: this.levelFor(diskPercent),
      },
      {
        key: 'network',
        label: 'Network',
        icon: 'swap_horiz',
        valueText: data.bandwidthBytesPerSec !== null ? `${fmtBytes(data.bandwidthBytesPerSec)}/s` : 'N/A',
        level: 'neutral',
      },
    ];
  }

  private placeholderStats(): StatBlockItem[] {
    return [
      { key: 'cpu', label: 'CPU Load', icon: 'memory', valueText: '...', level: 'neutral' },
      { key: 'ram', label: 'Memory', icon: 'developer_board', valueText: '...', level: 'neutral' },
      { key: 'disk', label: 'Disk', icon: 'storage', valueText: '...', level: 'neutral' },
      { key: 'network', label: 'Network', icon: 'swap_horiz', valueText: '...', level: 'neutral' },
    ];
  }

  async refreshLogs(silent = false) {
    if (!silent) this.loading.set(true);
    try {
      const data = await this.serverService.getLogs(this.serverId());
      this.logs.set(data);

      if (this.autoScroll()) {
        setTimeout(() => {
          const el = this.terminalBody()?.nativeElement;
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        }, 50);
      }
    } catch (err: any) {
      if (!silent) {
        this.toast.error(err.message || 'Gagal mengambil log dari Render.');
      }
    } finally {
      if (!silent) this.loading.set(false);
    }
  }

  toggleAutoScroll() {
    this.autoScroll.update((v) => !v);
  }

  clearLogs() {
    this.logs.set([]);
  }

  async redeployService() {
    try {
      this.toast.info('Deploy ulang di Render...');
      await this.serverService.deploy(this.serverId(), true);
      this.toast.success('Deploy ulang dimulai!');
      this.refreshLogs();
    } catch (err: any) {
      this.toast.error(err.message || 'Deploy ulang gagal.');
    }
  }
}
