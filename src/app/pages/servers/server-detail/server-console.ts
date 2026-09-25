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
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { ServerService } from '../../../core/services/server.service.js';
import { ToastService } from '../../../core/services/toast.service.js';
import { ServerTerminal } from './server-terminal.js';

@Component({
  selector: 'app-server-console',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, ServerTerminal],
  template: `
    <div class="space-y-4">
      <!-- Mode Switcher Tabs -->
      <div class="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="activeMode.set('terminal')"
            class="px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-2"
            [class.bg-emerald-950]="activeMode() === 'terminal'"
            [class.text-emerald-400]="activeMode() === 'terminal'"
            [class.border]="activeMode() === 'terminal'"
            [class.border-emerald-800]="activeMode() === 'terminal'"
            [class.text-neutral-400]="activeMode() !== 'terminal'"
            [class.hover:text-white]="activeMode() !== 'terminal'"
          >
            <mat-icon class="text-sm">terminal</mat-icon>
            <span class="font-bold">Interactive Terminal</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono">
              xterm.js
            </span>
          </button>

          <button
            type="button"
            (click)="activeMode.set('logs')"
            class="px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-2"
            [class.bg-emerald-950]="activeMode() === 'logs'"
            [class.text-emerald-400]="activeMode() === 'logs'"
            [class.border]="activeMode() === 'logs'"
            [class.border-emerald-800]="activeMode() === 'logs'"
            [class.text-neutral-400]="activeMode() !== 'logs'"
            [class.hover:text-white]="activeMode() !== 'logs'"
          >
            <mat-icon class="text-sm">receipt_long</mat-icon>
            <span>Render Log Stream</span>
          </button>
        </div>

        <div class="text-[11px] text-neutral-500 font-mono hidden sm:flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live WebSocket &amp; Storage Connected</span>
        </div>
      </div>

      <!-- Mode 1: Interactive Xterm.js Terminal Emulator -->
      @if (activeMode() === 'terminal') {
        <app-server-terminal
          [serverId]="serverId()"
          [serverName]="serverName()"
        />
      }

      <!-- Mode 2: Raw Render Deploy Stream Logs -->
      @if (activeMode() === 'logs') {
        <div class="space-y-4">
          <!-- Terminal Controls Bar -->
          <div class="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-t-xl px-4 py-2.5">
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1.5 mr-2">
                <span class="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                <span class="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                <span class="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              </div>
              <span class="text-xs font-mono text-neutral-300 font-semibold flex items-center gap-1.5">
                <mat-icon class="text-xs text-emerald-400">subject</mat-icon>
                <span>Render Deployment &amp; Service Events</span>
              </span>
              <span class="text-[10px] text-neutral-500 font-mono hidden sm:inline">&middot; Polling: 5s</span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="toggleAutoScroll()"
                class="px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer"
                [class.bg-emerald-950]="autoScroll()"
                [class.text-emerald-400]="autoScroll()"
                [class.text-neutral-400]="!autoScroll()"
              >
                Auto-Scroll: {{ autoScroll() ? 'ON' : 'OFF' }}
              </button>

              <button
                type="button"
                (click)="refreshLogs()"
                class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                title="Refresh Logs"
              >
                <mat-icon class="text-sm" [class.animate-spin]="loading()">refresh</mat-icon>
              </button>

              <button
                type="button"
                (click)="clearLogs()"
                class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                title="Clear Console View"
              >
                <mat-icon class="text-sm">delete_outline</mat-icon>
              </button>
            </div>
          </div>

          <!-- Terminal Output Screen -->
          <div
            #terminalBody
            class="bg-neutral-950 border-x border-b border-neutral-800 rounded-b-xl p-4 font-mono text-xs text-neutral-300 h-[480px] overflow-y-auto space-y-1 select-text shadow-inner"
          >
            @if (logs().length === 0) {
              <div class="text-neutral-600 italic py-8 text-center">
                Initializing connection to Render service pipeline...
              </div>
            } @else {
              @for (line of logs(); track $index) {
                <div
                  class="leading-relaxed hover:bg-neutral-900/40 px-1 rounded transition-colors break-words"
                  [class.text-rose-400]="line.includes('[ERROR]')"
                  [class.text-amber-300]="line.includes('[BUILD]')"
                  [class.text-emerald-400]="line.includes('[RUNTIME]') || line.includes('[LIVE]')"
                  [class.text-sky-300]="line.includes('[RENDER]') || line.includes('[GIT]')"
                >
                  {{ line }}
                </div>
              }
            }
          </div>

          <!-- Quick Command Prompt Bar (Info) -->
          <div class="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl flex items-center justify-between text-xs text-neutral-400">
            <div class="flex items-center gap-2">
              <mat-icon class="text-emerald-400 text-sm">info</mat-icon>
              <span>Logs are continuously synchronized from the official Render API events &amp; deploy streams.</span>
            </div>
            <button
              type="button"
              (click)="redeployService()"
              class="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <mat-icon class="text-xs">sync</mat-icon>
              <span>Redeploy &amp; Stream</span>
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

  terminalBody = viewChild<ElementRef>('terminalBody');

  serverId = signal<string>('');
  serverName = signal<string>('app');
  activeMode = signal<'terminal' | 'logs'>('terminal');

  logs = signal<string[]>([]);
  loading = signal<boolean>(false);
  autoScroll = signal<boolean>(true);

  private pollInterval?: any;

  ngOnInit() {
    this.route.parent?.paramMap.subscribe(async (params) => {
      const id = params.get('id');
      if (id) {
        this.serverId.set(id);
        this.refreshLogs();

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
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
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
        this.toast.error(err.message || 'Failed to fetch Render logs.');
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
      this.toast.info('Triggering deployment on Render...');
      await this.serverService.deploy(this.serverId(), true);
      this.toast.success('Redeploy triggered!');
      this.refreshLogs();
    } catch (err: any) {
      this.toast.error(err.message || 'Redeploy failed.');
    }
  }
}

