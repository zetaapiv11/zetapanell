import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { MetricSeries, ResourceMetrics } from '../../../core/models/index.js';
import { ServerService } from '../../../core/services/server.service.js';

interface GaugeCard {
  key: string;
  label: string;
  icon: string;
  valueText: string;
  subText: string;
  percent: number | null; // 0-100, null = show as "N/A" indeterminate
  sparkline: string; // SVG polyline points, empty if no data
  // Precomputed full literal Tailwind classes -- Tailwind's build-time scanner
  // only picks up class names that appear verbatim in source, so these can't
  // be assembled with string concatenation ('bg-' + color + '-500') at runtime.
  wrapClass: string;
  iconClass: string;
  barClass: string;
  strokeClass: string;
}

@Component({
  selector: 'app-server-metrics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="space-y-4 font-sans">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-white flex items-center gap-1.5">
            <mat-icon class="text-base text-emerald-400">monitor_heart</mat-icon>
            <span>Resource Monitor</span>
          </h2>
          <p class="text-[11px] text-neutral-500 mt-0.5">
            Live usage from Render, refreshed every 10s.
          </p>
        </div>

        <div class="flex items-center gap-1.5">
          @for (r of rangeOptions; track r.minutes) {
            <button
              type="button"
              (click)="setRange(r.minutes)"
              class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              [class.bg-emerald-600]="rangeMinutes() === r.minutes"
              [class.text-white]="rangeMinutes() === r.minutes"
              [class.bg-neutral-900]="rangeMinutes() !== r.minutes"
              [class.text-neutral-400]="rangeMinutes() !== r.minutes"
              [class.border]="true"
              [class.border-neutral-800]="rangeMinutes() !== r.minutes"
              [class.border-emerald-600]="rangeMinutes() === r.minutes"
            >
              {{ r.label }}
            </button>
          }
        </div>
      </div>

      @if (loading() && !cards().length) {
        <div class="p-10 text-center text-neutral-500 text-xs">
          <mat-icon class="text-2xl animate-spin mb-2">refresh</mat-icon>
          <div>Fetching metrics from Render...</div>
        </div>
      } @else if (error()) {
        <div class="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs flex items-start gap-2">
          <mat-icon class="text-sm mt-0.5">info</mat-icon>
          <div>{{ error() }}</div>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          @for (card of cards(); track card.key) {
            <div class="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center" [class]="card.wrapClass">
                    <mat-icon class="text-sm">{{ card.icon }}</mat-icon>
                  </div>
                  <span class="text-[11px] font-semibold text-neutral-300 uppercase tracking-wide">{{ card.label }}</span>
                </div>
                @if (card.percent !== null) {
                  <span class="text-[11px] font-mono text-neutral-400">{{ card.percent }}%</span>
                }
              </div>

              <div>
                <div class="text-lg font-bold text-white font-mono">{{ card.valueText }}</div>
                <div class="text-[10px] text-neutral-500">{{ card.subText }}</div>
              </div>

              @if (card.percent !== null) {
                <div class="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [class]="card.barClass"
                    [style.width.%]="card.percent"
                  ></div>
                </div>
              }

              @if (card.sparkline) {
                <svg viewBox="0 0 100 28" preserveAspectRatio="none" class="w-full h-7 opacity-80">
                  <polyline
                    [attr.points]="card.sparkline"
                    fill="none"
                    [class]="card.strokeClass"
                    stroke-width="2"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
              } @else {
                <div class="h-7 flex items-center text-[10px] text-neutral-600 italic">No data for this range</div>
              }
            </div>
          }
        </div>

        @if (hasNoDisk()) {
          <p class="text-[10px] text-neutral-600 italic">
            Disk usage isn't shown because this service has no persistent disk attached.
          </p>
        }
      }
    </div>
  `,
})
export class ServerMetrics implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private serverService = inject(ServerService);

  private serverId = '';
  private pollInterval?: any;

  loading = signal(true);
  error = signal<string | null>(null);
  cards = signal<GaugeCard[]>([]);
  hasNoDisk = signal(false);
  rangeMinutes = signal(30);

  rangeOptions = [
    { label: '30m', minutes: 30 },
    { label: '3h', minutes: 180 },
    { label: '24h', minutes: 1440 },
  ];

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.serverId = id;
        this.fetchMetrics();
      }
    });

    this.pollInterval = setInterval(() => this.fetchMetrics(), 10000);
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  setRange(minutes: number) {
    this.rangeMinutes.set(minutes);
    this.fetchMetrics();
  }

  async fetchMetrics() {
    if (!this.serverId) return;
    try {
      const data = await this.serverService.getMetrics(this.serverId, this.rangeMinutes());
      this.error.set(null);
      this.hasNoDisk.set(data.diskCapacityBytes === null);
      this.cards.set(this.buildCards(data));
    } catch (err: any) {
      this.error.set(err.error?.error || err.message || 'Could not load metrics from Render.');
    } finally {
      this.loading.set(false);
    }
  }

  // Full literal class strings per card, one object per color -- keeps every
  // class name Tailwind needs to see verbatim somewhere in this file.
  private readonly palette = {
    emerald: {
      wrapClass: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
      iconClass: 'text-emerald-400',
      barClass: 'bg-emerald-500',
      strokeClass: 'stroke-emerald-400',
    },
    sky: {
      wrapClass: 'bg-sky-500/10 border border-sky-500/20 text-sky-400',
      iconClass: 'text-sky-400',
      barClass: 'bg-sky-500',
      strokeClass: 'stroke-sky-400',
    },
    violet: {
      wrapClass: 'bg-violet-500/10 border border-violet-500/20 text-violet-400',
      iconClass: 'text-violet-400',
      barClass: 'bg-violet-500',
      strokeClass: 'stroke-violet-400',
    },
    amber: {
      wrapClass: 'bg-amber-500/10 border border-amber-500/20 text-amber-400',
      iconClass: 'text-amber-400',
      barClass: 'bg-amber-500',
      strokeClass: 'stroke-amber-400',
    },
  } as const;

  private buildCards(data: ResourceMetrics): GaugeCard[] {
    const memoryPercent = null; // Render doesn't give a fixed memory limit via this endpoint; show raw usage instead.
    const diskPercent =
      data.diskUsedBytes !== null && data.diskCapacityBytes
        ? Math.round((data.diskUsedBytes / data.diskCapacityBytes) * 100)
        : null;

    return [
      {
        key: 'cpu',
        label: 'CPU',
        icon: 'memory',
        valueText: data.cpuPercent !== null ? `${data.cpuPercent}%` : 'N/A',
        subText: 'of 1 vCPU',
        percent: data.cpuPercent,
        sparkline: this.toSparkline(data.series.cpu),
        ...this.palette.emerald,
      },
      {
        key: 'ram',
        label: 'RAM',
        icon: 'developer_board',
        valueText: this.formatBytes(data.memoryBytes),
        subText: data.memoryUnit ? `unit: ${data.memoryUnit}` : 'memory in use',
        percent: memoryPercent,
        sparkline: this.toSparkline(data.series.memory),
        ...this.palette.sky,
      },
      {
        key: 'disk',
        label: 'Disk',
        icon: 'storage',
        valueText:
          data.diskUsedBytes !== null
            ? `${this.formatBytes(data.diskUsedBytes)} / ${this.formatBytes(data.diskCapacityBytes)}`
            : 'N/A',
        subText: data.diskCapacityBytes === null ? 'no persistent disk' : 'used / total',
        percent: diskPercent,
        sparkline: this.toSparkline(data.series.diskUsage),
        ...this.palette.violet,
      },
      {
        key: 'network',
        label: 'Network',
        icon: 'swap_horiz',
        valueText: this.formatBytesPerSec(data.bandwidthBytesPerSec),
        subText: 'outbound bandwidth',
        percent: null,
        sparkline: this.toSparkline(data.series.bandwidth),
        ...this.palette.amber,
      },
    ];
  }

  private toSparkline(series: MetricSeries[]): string {
    const values = series[0]?.values;
    if (!values || values.length < 2) return '';
    const nums = values.map((v) => v.value);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    const stepX = 100 / (nums.length - 1);
    return nums
      .map((v, i) => {
        const x = (i * stepX).toFixed(2);
        // Invert Y since SVG y grows downward; leave a little headroom top/bottom.
        const y = (26 - ((v - min) / range) * 24).toFixed(2);
        return `${x},${y}`;
      })
      .join(' ');
  }

  private formatBytes(bytes: number | null): string {
    if (bytes === null) return 'N/A';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  private formatBytesPerSec(bytes: number | null): string {
    if (bytes === null) return 'N/A';
    return `${this.formatBytes(bytes)}/s`;
  }
}
