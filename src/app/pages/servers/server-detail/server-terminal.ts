import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ServerService } from '../../../core/services/server.service.js';
import { ToastService } from '../../../core/services/toast.service.js';

@Component({
  selector: 'app-server-terminal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="relative">
      <!-- Xterm.js Container -- output only, matches Pterodactyl's Console.tsx
           (disableStdin: true; typing happens in the separate input below) -->
      <div class="rounded-t bg-[#131a20] overflow-hidden">
        <div #terminalElement class="w-full h-[420px] p-2"></div>
      </div>

      <!-- Command Input Bar -- separate input below the terminal, exactly like
           Pterodactyl's <input placeholder="Type a command..."> + chevron icon,
           instead of typing directly into the terminal. -->
      <div class="relative">
        <input
          #commandInput
          type="text"
          [disabled]="isBusy()"
          (keydown)="handleCommandKeyDown($event)"
          placeholder="Type a command..."
          autocorrect="off"
          autocapitalize="none"
          aria-label="Console command input."
          class="peer w-full bg-neutral-900 text-sm text-neutral-100 placeholder-neutral-500 rounded-b px-4 py-3 pr-10 outline-none border-t border-neutral-700 disabled:opacity-50"
        />
        <div class="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 peer-focus:text-neutral-100 peer-focus:animate-pulse pointer-events-none">
          <mat-icon class="text-base">keyboard_double_arrow_right</mat-icon>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class ServerTerminal implements AfterViewInit, OnDestroy {
  serverId = input.required<string>();
  serverName = input<string>('app');

  terminalElement = viewChild<ElementRef<HTMLDivElement>>('terminalElement');
  commandInput = viewChild<ElementRef<HTMLInputElement>>('commandInput');

  private platformId = inject(PLATFORM_ID);
  private serverService = inject(ServerService);
  private toast = inject(ToastService);

  connected = signal<boolean>(false);
  isBusy = signal<boolean>(false);

  private terminal: any = null;
  private fitAddon: any = null;
  private resizeObserver: ResizeObserver | null = null;

  private history: string[] = [];
  private historyIndex = -1;

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initTerminal();
    }
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.terminal) {
      this.terminal.dispose();
    }
  }

  private async initTerminal() {
    const el = this.terminalElement()?.nativeElement;
    if (!el) return;

    try {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      this.terminal = new Terminal({
        disableStdin: true,
        cursorStyle: 'underline',
        allowTransparency: true,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Courier New", monospace',
        fontSize: 12,
        rows: 30,
        theme: {
          // Matches Pterodactyl's actual Console.tsx xterm theme exactly.
          background: '#131a20',
          cursor: 'transparent',
          black: '#131a20',
          red: '#E54B4B',
          green: '#9ECE58',
          yellow: '#FAED70',
          blue: '#396FE2',
          magenta: '#BB80B3',
          cyan: '#2DDAFD',
          white: '#d0d0d0',
          brightBlack: 'rgba(255, 255, 255, 0.2)',
          brightRed: '#FF5370',
          brightGreen: '#C3E88D',
          brightYellow: '#FFCB6B',
          brightBlue: '#82AAFF',
          brightMagenta: '#C792EA',
          brightCyan: '#89DDFF',
          brightWhite: '#ffffff',
          selectionBackground: '#FAF089',
        },
      });

      this.fitAddon = new FitAddon();
      this.terminal.loadAddon(this.fitAddon);

      this.terminal.open(el);
      this.fitAddon.fit();

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          try {
            this.fitAddon.fit();
          } catch {
            // Ignored if terminal container is hidden
          }
        });
        this.resizeObserver.observe(el);
      }

      this.connected.set(true);
      this.printWelcomeLine();
    } catch (err: any) {
      console.error('[Terminal] Initialization failed:', err);
      this.toast.error('Failed to initialize Xterm terminal emulator.');
    }
  }

  private prelude(): string {
    const name = (this.serverName() || 'app').toLowerCase();
    // Bold yellow prelude -- matches Pterodactyl's TERMINAL_PRELUDE exactly
    // ('\x1b[1m\x1b[33mcontainer@pterodactyl~ ').
    return `\x1b[1m\x1b[33m${name}@zetapanel~ \x1b[0m`;
  }

  private printWelcomeLine() {
    if (!this.terminal) return;
    this.terminal.writeln(this.prelude() + 'Connected. Type a command below and press Enter.\u001b[0m');
  }

  private writeOutput(line: string) {
    if (!this.terminal) return;
    this.terminal.writeln(this.prelude() + line.replace(/(?:\r\n|\r|\n)$/, '') + '\u001b[0m');
  }

  handleCommandKeyDown(e: KeyboardEvent) {
    const input = e.target as HTMLInputElement;

    if (e.key === 'ArrowUp') {
      const newIndex = Math.min(this.historyIndex + 1, this.history.length - 1);
      this.historyIndex = newIndex;
      input.value = this.history[newIndex] || '';
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowDown') {
      const newIndex = Math.max(this.historyIndex - 1, -1);
      this.historyIndex = newIndex;
      input.value = newIndex === -1 ? '' : this.history[newIndex] || '';
      return;
    }

    const command = input.value;
    if (e.key === 'Enter' && command.trim().length > 0 && !this.isBusy()) {
      this.history = [command, ...this.history].slice(0, 32);
      this.historyIndex = -1;
      input.value = '';
      this.executeCommand(command.trim());
    }
  }

  async executeCommand(command: string) {
    if (!this.terminal) return;

    if (command === 'clear') {
      this.terminal.clear();
      return;
    }

    this.isBusy.set(true);
    this.terminal.writeln(this.prelude() + '\x1b[2m$ ' + command + '\x1b[0m');

    try {
      const res = await this.serverService.execCommand(this.serverId(), command);
      if (res.output) {
        this.writeOutput(res.output);
      }
    } catch (err: any) {
      this.terminal.writeln('\x1b[1m\x1b[41m' + (err.message || 'Command execution failed') + '\u001b[0m');
    } finally {
      this.isBusy.set(false);
    }
  }
}
