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
    <div class="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-2xl flex flex-col font-sans">
      <!-- Terminal Header / Titlebar -->
      <div class="flex items-center justify-between bg-neutral-900 border-b border-neutral-800 px-4 py-2.5">
        <div class="flex items-center gap-2">
          <!-- Window Controls Dots -->
          <div class="flex items-center gap-1.5 mr-2">
            <span class="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>

          <div class="flex items-center gap-2 text-xs font-mono text-neutral-300">
            <mat-icon class="text-sm text-emerald-400">terminal</mat-icon>
            <span class="font-bold text-white">xterm.js</span>
            <span class="text-neutral-500 font-normal">|</span>
            <span class="text-neutral-400">{{ serverName() || 'service' }}&#64;render</span>
          </div>

          <span
            class="px-2 py-0.5 rounded text-[10px] font-mono border"
            [class.bg-emerald-950]="connected()"
            [class.border-emerald-800]="connected()"
            [class.text-emerald-400]="connected()"
            [class.bg-neutral-800]="!connected()"
            [class.border-neutral-700]="!connected()"
            [class.text-neutral-400]="!connected()"
          >
            {{ connected() ? 'ONLINE' : 'CONNECTING' }}
          </span>
        </div>

        <!-- Terminal Header Actions -->
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            (click)="runPresetCommand('help')"
            class="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-mono transition-colors cursor-pointer"
            title="Show Help"
          >
            help
          </button>

          <button
            type="button"
            (click)="runPresetCommand('status')"
            class="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-mono transition-colors cursor-pointer"
            title="Check Render Service Status"
          >
            status
          </button>

          <button
            type="button"
            (click)="runPresetCommand('ls -la')"
            class="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-mono transition-colors cursor-pointer"
            title="List Storage Files"
          >
            ls
          </button>

          <button
            type="button"
            (click)="runPresetCommand('restart')"
            class="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1"
            title="Re-run container on Render"
          >
            <mat-icon class="text-xs">bolt</mat-icon>
            <span>restart</span>
          </button>

          <div class="h-3 w-px bg-neutral-700 mx-1"></div>

          <button
            type="button"
            (click)="clearTerminal()"
            class="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Clear Terminal View (Ctrl+L)"
          >
            <mat-icon class="text-sm">delete_outline</mat-icon>
          </button>

          <button
            type="button"
            (click)="fitTerminal()"
            class="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Fit Terminal"
          >
            <mat-icon class="text-sm">aspect_ratio</mat-icon>
          </button>
        </div>
      </div>

      <!-- Xterm.js Container -->
      <div
        #terminalElement
        tabindex="0"
        role="region"
        aria-label="Interactive Terminal Emulator"
        class="w-full h-[460px] bg-[#131a20] p-2 select-text outline-none focus:ring-1 focus:ring-cyan-500/50"
        (click)="focusTerminal()"
        (keydown)="focusTerminal()"
      ></div>

      <!-- Quick Command Bar -->
      <div class="bg-neutral-900/80 border-t border-neutral-800 px-4 py-2 flex items-center justify-between text-xs text-neutral-400 flex-wrap gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[11px] text-neutral-500 font-mono">Quick Run:</span>
          @for (cmd of commonCommands; track cmd) {
            <button
              type="button"
              (click)="runPresetCommand(cmd)"
              class="px-2 py-0.5 rounded bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-mono text-[11px] cursor-pointer transition-colors"
            >
              {{ cmd }}
            </button>
          }
        </div>

        <div class="text-[11px] text-neutral-500 font-mono hidden md:flex items-center gap-3">
          <span>&uarr;&darr; History</span>
          <span>Tab Complete</span>
          <span>Ctrl+C Interrupt</span>
          <span>Ctrl+L Clear</span>
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

  private platformId = inject(PLATFORM_ID);
  private serverService = inject(ServerService);
  private toast = inject(ToastService);

  connected = signal<boolean>(false);
  isBusy = signal<boolean>(false);

  readonly commonCommands = [
    'help',
    'status',
    'ls',
    'cat package.json',
    'env',
    'ps',
    'free -m',
    'logs',
    'restart',
  ];

  private terminal: any = null;
  private fitAddon: any = null;
  private resizeObserver: ResizeObserver | null = null;

  // Command Line State
  private inputBuffer = '';
  private history: string[] = [];
  private historyIndex = -1;

  private availableCompletions = [
    'help',
    'status',
    'ls',
    'dir',
    'cat',
    'env',
    'printenv',
    'restart',
    'rerun',
    'start',
    'stop',
    'logs',
    'node -v',
    'python --version',
    'npm start',
    'npm test',
    'ps',
    'top',
    'free -m',
    'uname -a',
    'whoami',
    'pwd',
    'clear',
  ];

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
      // Dynamic import of xterm and fit addon
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      this.terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.25,
        convertEol: true,
        theme: {
          // Matches Pterodactyl's actual Console.tsx xterm theme exactly.
          background: '#131a20',
          foreground: '#f4f4f5',
          cursor: '#2DDAFD',
          selectionBackground: '#FAF089',
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
        },
      });

      this.fitAddon = new FitAddon();
      this.terminal.loadAddon(this.fitAddon);

      this.terminal.open(el);
      this.fitAddon.fit();

      // Listen for window/container resize
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.fitTerminal();
        });
        this.resizeObserver.observe(el);
      }

      this.connected.set(true);

      // Print Welcome Banner
      this.printWelcomeBanner();

      // Setup Key Event Listener
      this.setupKeyHandlers();
    } catch (err: any) {
      console.error('[Terminal] Initialization failed:', err);
      this.toast.error('Failed to initialize Xterm terminal emulator.');
    }
  }

  private printWelcomeBanner() {
    if (!this.terminal) return;

    const banner = [
      '\x1b[1;32m   ______     __        ____                  __\x1b[0m',
      '\x1b[1;32m  /__  /___  / /_____ _/ __ \\____ _____  ___  / /\x1b[0m',
      '\x1b[1;32m    / // _ \\/ __/ __ `/ /_/ / __ `/ __ \\/ _ \\/ /\x1b[0m',
      '\x1b[1;32m   / //  __/ /_/ /_/ / ____/ /_/ / / / /  __/ /\x1b[0m',
      '\x1b[1;32m  /___/\\___/\\__/\\__,_/_/    \\__,_/_/ /_/\\___/_/\x1b[0m',
      '\x1b[90m  --------------------------------------------------\x1b[0m',
      '\x1b[1;37m  Container Interactive Terminal Emulator (xterm.js)\x1b[0m',
      `\x1b[90m  Connected to:\x1b[0m \x1b[1;33mCloudflare R2 Bucket + Render Runtime\x1b[0m`,
      '\x1b[90m  Type \x1b[1;32mhelp\x1b[90m for commands or press [Tab] to auto-complete.\x1b[0m',
      '',
    ];

    for (const line of banner) {
      this.terminal.writeln(line);
    }

    this.prompt();
  }

  private prompt() {
    if (!this.terminal) return;
    const name = (this.serverName() || 'app').toLowerCase();
    // Bold yellow prompt -- matches Pterodactyl's TERMINAL_PRELUDE style
    // ('\x1b[1;33m container@pterodactyl~ ') instead of the green one.
    this.terminal.write(`\x1b[1;33mbot@zetapanel\x1b[0m:\x1b[1;34m~/${name}\x1b[0m$ `);
  }

  private setupKeyHandlers() {
    if (!this.terminal) return;

    this.terminal.onData((data: string) => {
      if (this.isBusy()) return;

      const code = data.charCodeAt(0);

      // Handle Enter (CR: 13, LF: 10)
      if (code === 13 || code === 10) {
        this.terminal.writeln('');
        const cmd = this.inputBuffer.trim();
        this.inputBuffer = '';
        this.historyIndex = -1;

        if (cmd) {
          this.history.push(cmd);
          this.executeCommand(cmd);
        } else {
          this.prompt();
        }
        return;
      }

      // Handle Backspace (127 or 8)
      if (code === 127 || code === 8) {
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.terminal.write('\b \b');
        }
        return;
      }

      // Handle Ctrl+C (3)
      if (code === 3) {
        this.terminal.writeln('^C');
        this.inputBuffer = '';
        this.historyIndex = -1;
        this.prompt();
        return;
      }

      // Handle Ctrl+L (12 - Clear)
      if (code === 12) {
        this.clearTerminal();
        return;
      }

      // Handle Tab (9 - Auto-completion)
      if (code === 9) {
        this.handleTabCompletion();
        return;
      }

      // Handle ANSI Arrow Keys (Escape sequence: \x1b[A, \x1b[B, \x1b[C, \x1b[D)
      if (data.startsWith('\x1b[')) {
        const arrow = data.substring(2);
        if (arrow === 'A') {
          // Up Arrow - Previous command
          this.navigateHistory(-1);
          return;
        } else if (arrow === 'B') {
          // Down Arrow - Next command
          this.navigateHistory(1);
          return;
        }
        return;
      }

      // Normal character input
      if (data >= ' ' && data <= '~') {
        this.inputBuffer += data;
        this.terminal.write(data);
      }
    });
  }

  private handleTabCompletion() {
    const current = this.inputBuffer.trim();
    if (!current) return;

    const matches = this.availableCompletions.filter((c) => c.startsWith(current));
    if (matches.length === 1) {
      const completion = matches[0].substring(current.length);
      this.inputBuffer += completion;
      this.terminal.write(completion);
    } else if (matches.length > 1) {
      this.terminal.writeln('');
      this.terminal.writeln('\x1b[90m' + matches.join('   ') + '\x1b[0m');
      this.prompt();
      this.terminal.write(this.inputBuffer);
    }
  }

  private navigateHistory(direction: number) {
    if (this.history.length === 0) return;

    if (this.historyIndex === -1) {
      this.historyIndex = this.history.length;
    }

    const nextIndex = this.historyIndex + direction;
    if (nextIndex >= 0 && nextIndex <= this.history.length) {
      this.historyIndex = nextIndex;

      // Clear current input from terminal line
      while (this.inputBuffer.length > 0) {
        this.terminal.write('\b \b');
        this.inputBuffer = this.inputBuffer.slice(0, -1);
      }

      if (this.historyIndex < this.history.length) {
        const cmd = this.history[this.historyIndex];
        this.inputBuffer = cmd;
        this.terminal.write(cmd);
      }
    }
  }

  async executeCommand(command: string) {
    if (!this.terminal) return;

    if (command === 'clear') {
      this.clearTerminal();
      return;
    }

    this.isBusy.set(true);

    try {
      const res = await this.serverService.execCommand(this.serverId(), command);
      if (res.output) {
        this.terminal.writeln(res.output);
      }
    } catch (err: any) {
      this.terminal.writeln(`\x1b[31mError: ${err.message || 'Command execution failed'}\x1b[0m`);
    } finally {
      this.isBusy.set(false);
      this.prompt();
    }
  }

  runPresetCommand(command: string) {
    if (!this.terminal || this.isBusy()) return;
    this.terminal.writeln(command);
    this.executeCommand(command);
  }

  clearTerminal() {
    if (!this.terminal) return;
    this.terminal.clear();
    this.inputBuffer = '';
    this.prompt();
  }

  fitTerminal() {
    if (this.fitAddon && this.terminal) {
      try {
        this.fitAddon.fit();
      } catch {
        // Ignored if terminal container is hidden
      }
    }
  }

  focusTerminal() {
    if (this.terminal) {
      this.terminal.focus();
    }
  }
}
