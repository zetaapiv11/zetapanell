import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service.js';
import { PlatformConfigService } from '../../core/services/platform-config.service.js';
import { FileService } from '../../core/services/file.service.js';
import { ServerService } from '../../core/services/server.service.js';
import { ToastService } from '../../core/services/toast.service.js';

@Component({
  selector: 'app-server-create',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule, RouterLink],
  template: `
    <div class="max-w-4xl mx-auto space-y-6 font-sans">
      <!-- Breadcrumb & Header -->
      <div class="border-b border-neutral-800 pb-4">
        <div class="text-xs text-neutral-500 font-mono mb-1">Servers / New</div>
        <h1 class="text-xl font-bold tracking-tight text-white">Create Infrastructure Service</h1>
        <p class="text-xs text-neutral-400 mt-1">
          Provisions a native service directly on Render API with Cloudflare R2 storage bridge.
        </p>
      </div>

      <!-- No Active Quota Warning Banner -->
      @if (hasNoQuota()) {
        <div class="p-5 rounded-2xl border border-amber-800/80 bg-gradient-to-r from-amber-950/50 to-neutral-900/80 space-y-3 shadow-lg">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <mat-icon class="text-xl">lock</mat-icon>
            </div>
            <div>
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <span>Kuota Server Belum Aktif (0 Server)</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">Perlu Upgrade</span>
              </h3>
              <p class="text-xs text-neutral-300 mt-1 leading-relaxed">
                Akun Anda belum memiliki kuota server yang dibeli dari Admin. Untuk menjaga keamanan dan kestabilan resource, pembuatan server hanya dapat dilakukan setelah Admin mengaktifkan paket hosting Anda.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3 pt-1 flex-wrap">
            <a
              [href]="buyQuotaWaUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <mat-icon class="text-sm">chat</mat-icon>
              <span>Hubungi Admin WhatsApp ({{ platformConfig.adminWhatsApp().display }})</span>
            </a>
            <a
              routerLink="/plans"
              class="px-3.5 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Lihat Pilihan Paket
            </a>
          </div>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
        <!-- 1. General Configuration -->
        <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
            <mat-icon class="text-sm text-emerald-400">tune</mat-icon>
            <span>Service Identity &amp; Type</span>
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Server Name *</label>
              <input
                type="text"
                formControlName="name"
                placeholder="e.g. my-discord-bot or api-service"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none font-mono"
              />
              <p class="text-[11px] text-neutral-500 mt-1">Must be lowercase alphanumeric and hyphens.</p>
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Description (Optional)</label>
              <input
                type="text"
                formControlName="description"
                placeholder="e.g. Production music bot worker"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Service Type *</label>
              <select
                formControlName="serviceType"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
              >
                <option value="background_worker">Background Worker (Bots, Queues)</option>
                <option value="web_service">Web Service (HTTP, REST, API)</option>
                <option value="private_service">Private Service (Internal VPC)</option>
                <option value="cron_job">Cron Job (Scheduled tasks)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Runtime *</label>
              <select
                formControlName="runtime"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
              >
                <option value="node">Node.js (LTS)</option>
                <option value="python">Python 3</option>
                <option value="docker">Docker Container</option>
                <option value="go">Go</option>
                <option value="ruby">Ruby</option>
                <option value="elixir">Elixir</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Region *</label>
              <select
                formControlName="region"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
              >
                <option value="oregon">Oregon (US West)</option>
                <option value="ohio">Ohio (US East)</option>
                <option value="frankfurt">Frankfurt (EU Central)</option>
                <option value="singapore">Singapore (Asia)</option>
                <option value="virginia">Virginia (US East)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 2. Source Strategy: Git Repo vs ZetaPanel Managed Storage (R2) -->
        <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
            <mat-icon class="text-sm text-emerald-400">source</mat-icon>
            <span>Source Code &amp; Storage Strategy</span>
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              class="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all"
              [class.bg-neutral-800/80]="form.get('repoType')?.value === 'r2_managed'"
              [class.border-emerald-500]="form.get('repoType')?.value === 'r2_managed'"
              [class.border-neutral-800]="form.get('repoType')?.value !== 'r2_managed'"
            >
              <input
                type="radio"
                formControlName="repoType"
                value="r2_managed"
                class="mt-0.5 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <div class="text-xs font-semibold text-white">ZetaPanel Managed Storage (R2 &amp; ZIP)</div>
                <div class="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  Store and manage files via Cloudflare R2 file manager. ZetaPanel bridges code directly to Render through its internal Git server.
                </div>
              </div>
            </label>

            <label
              class="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all"
              [class.bg-neutral-800/80]="form.get('repoType')?.value === 'git'"
              [class.border-emerald-500]="form.get('repoType')?.value === 'git'"
              [class.border-neutral-800]="form.get('repoType')?.value !== 'git'"
            >
              <input
                type="radio"
                formControlName="repoType"
                value="git"
                class="mt-0.5 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <div class="text-xs font-semibold text-white">External Git Repository</div>
                <div class="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  Connect an existing GitHub, GitLab, or Git repository URL directly to Render.
                </div>
              </div>
            </label>
          </div>

          @if (form.get('repoType')?.value === 'r2_managed') {
            <div class="space-y-3">
              <!-- Upload Mode Switcher -->
              <div class="flex items-center gap-2 border-b border-neutral-800 pb-2">
                <button
                  type="button"
                  (click)="sourceOption.set('upload')"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
                  [class.bg-emerald-950]="sourceOption() === 'upload'"
                  [class.text-emerald-400]="sourceOption() === 'upload'"
                  [class.border]="sourceOption() === 'upload'"
                  [class.border-emerald-800]="sourceOption() === 'upload'"
                  [class.text-neutral-400]="sourceOption() !== 'upload'"
                >
                  <mat-icon class="text-sm">upload_file</mat-icon>
                  <span>Upload Script / ZIP (Direct Web)</span>
                </button>
                <button
                  type="button"
                  (click)="sourceOption.set('template')"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
                  [class.bg-emerald-950]="sourceOption() === 'template'"
                  [class.text-emerald-400]="sourceOption() === 'template'"
                  [class.border]="sourceOption() === 'template'"
                  [class.border-emerald-800]="sourceOption() === 'template'"
                  [class.text-neutral-400]="sourceOption() !== 'template'"
                >
                  <mat-icon class="text-sm">auto_awesome</mat-icon>
                  <span>Starter Template</span>
                </button>
              </div>

              @if (sourceOption() === 'upload') {
                <div class="space-y-2">
                  <!-- Drag and Drop Zone -->
                  <div
                    (dragover)="onDragOver($event)"
                    (dragleave)="onDragLeave($event)"
                    (drop)="onDrop($event)"
                    class="p-6 rounded-xl border-2 border-dashed transition-all text-center relative flex flex-col items-center justify-center cursor-pointer"
                    [class.border-emerald-500]="dragOver()"
                    [class.bg-emerald-950/20]="dragOver()"
                    [class.border-neutral-800]="!dragOver()"
                    [class.bg-neutral-950]="!dragOver()"
                  >
                    @if (selectedFile()) {
                      <div class="flex items-center gap-3 p-3 rounded-lg bg-neutral-900 border border-neutral-800 w-full max-w-md">
                        <mat-icon class="text-emerald-400 text-2xl">folder_zip</mat-icon>
                        <div class="text-left flex-1 min-w-0">
                          <div class="text-xs font-semibold text-white truncate font-mono">
                            {{ selectedFile()?.name }}
                          </div>
                          <div class="text-[10px] text-neutral-400 font-mono">
                            {{ formatBytes(selectedFile()?.size || 0) }} &bull; Will auto-upload to Cloudflare R2 &amp; auto-extract
                          </div>
                        </div>
                        <button
                          type="button"
                          (click)="removeSelectedFile($event)"
                          class="p-1 rounded text-neutral-400 hover:text-rose-400 cursor-pointer"
                          title="Remove file"
                        >
                          <mat-icon class="text-sm">close</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <mat-icon class="text-3xl text-neutral-500 mb-2">cloud_upload</mat-icon>
                      <div class="text-xs font-medium text-neutral-200">
                        Drag &amp; drop your bot script or ZIP archive here
                      </div>
                      <div class="text-[11px] text-neutral-500 mt-1">
                        Supports <span class="font-mono text-neutral-300">.zip</span>, <span class="font-mono text-neutral-300">.js</span>, <span class="font-mono text-neutral-300">.py</span>, <span class="font-mono text-neutral-300">.ts</span>, <span class="font-mono text-neutral-300">.tar.gz</span>
                      </div>
                      <label
                        class="mt-3 px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer inline-flex items-center gap-1.5 transition-colors border border-neutral-700"
                      >
                        <mat-icon class="text-sm">folder_open</mat-icon>
                        <span>Choose File from PC</span>
                        <input
                          type="file"
                          (change)="onFileSelected($event)"
                          accept=".zip,.js,.py,.ts,.json,.tar.gz"
                          class="hidden"
                        />
                      </label>
                    }
                  </div>
                  <div class="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                    <mat-icon class="text-xs">check_circle</mat-icon>
                    <span>Instant Cloudflare R2 storage sync + Render Auto-Deploy on creation</span>
                  </div>
                </div>
              } @else {
                <div class="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-2">
                  <label class="block text-xs font-medium text-neutral-300">Initial Project Template</label>
                  <div class="flex items-center gap-3">
                    <label class="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                      <input type="radio" formControlName="initialTemplate" value="discord-bot" />
                      <span>Discord Bot Starter (discord.js ready)</span>
                    </label>
                    <label class="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                      <input type="radio" formControlName="initialTemplate" value="node-http" />
                      <span>Node.js Web Server</span>
                    </label>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">Repository URL *</label>
                <input
                  type="text"
                  formControlName="repoUrl"
                  placeholder="https://github.com/username/repository.git"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none font-mono"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-neutral-300 mb-1.5">Branch</label>
                <input
                  type="text"
                  formControlName="branch"
                  placeholder="main"
                  class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                />
              </div>
            </div>
          }
        </div>

        <!-- 3. Build & Execution Commands -->
        <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
            <mat-icon class="text-sm text-emerald-400">terminal</mat-icon>
            <span>Build &amp; Startup Commands</span>
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Build Command</label>
              <input
                type="text"
                formControlName="buildCommand"
                placeholder="npm install"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Start Command *</label>
              <input
                type="text"
                formControlName="startCommand"
                placeholder="npm start"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>
          </div>

          <div class="flex items-center gap-6 pt-1 text-xs">
            <label class="inline-flex items-center gap-2 text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                formControlName="autoDeploy"
                class="rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Auto Deploy on Git pushes &amp; file syncs</span>
            </label>
          </div>
        </div>

        <!-- 4. Environment Variables -->
        <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
              <mat-icon class="text-sm text-emerald-400">key</mat-icon>
              <span>Environment Variables</span>
            </h2>
            <button
              type="button"
              (click)="addEnvVar()"
              class="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <mat-icon class="text-xs">add</mat-icon>
              <span>Add Variable</span>
            </button>
          </div>

          @if (envVarsArray.length === 0) {
            <div class="p-4 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-lg">
              No environment variables defined yet. E.g. DISCORD_TOKEN, BOT_TOKEN, NODE_ENV.
            </div>
          } @else {
            <div class="space-y-2">
              @for (ctrl of envVarsArray.controls; track $index) {
                <div [formGroup]="$any(ctrl)" class="flex items-center gap-2">
                  <input
                    type="text"
                    formControlName="key"
                    placeholder="KEY"
                    class="w-1/3 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono uppercase"
                  />
                  <input
                    type="text"
                    formControlName="value"
                    placeholder="VALUE"
                    class="flex-1 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    (click)="removeEnvVar($index)"
                    class="p-1.5 rounded hover:bg-rose-950/40 text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <mat-icon class="text-sm">delete</mat-icon>
                  </button>
                </div>
              }
            </div>
          }
        </div>

        <!-- Submit Button -->
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            (click)="router.navigate(['/servers'])"
            class="px-4 py-2 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            [disabled]="loading() || form.invalid || hasNoQuota()"
            class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            @if (loading()) {
              <mat-icon class="text-sm animate-spin">refresh</mat-icon>
              <span>Creating on Render API...</span>
            } @else {
              <mat-icon class="text-sm">rocket_launch</mat-icon>
              <span>Deploy Service</span>
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ServerCreate {
  readonly auth = inject(AuthService);
  readonly platformConfig = inject(PlatformConfigService);

  constructor() {
    this.platformConfig.load();
  }

  buyQuotaWaUrl(): string {
    const wa = this.platformConfig.adminWhatsApp();
    const text = 'Halo Admin ZetaPanel, saya ingin membeli dan mengaktifkan kuota server hosting.';
    return `https://wa.me/${wa.number}?text=${encodeURIComponent(text)}`;
  }
  private serverService = inject(ServerService);
  private fileService = inject(FileService);
  private toast = inject(ToastService);
  readonly router = inject(Router);

  hasNoQuota = computed(() => {
    const user = this.auth.user();
    if (!user) return true;
    if (user.role === 'SUPER_ADMIN') return false;
    return (user.maxServers || 0) <= 0;
  });

  loading = signal(false);
  sourceOption = signal<'upload' | 'template'>('upload');
  selectedFile = signal<File | null>(null);
  dragOver = signal<boolean>(false);

  form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
    description: new FormControl(''),
    serviceType: new FormControl('background_worker', [Validators.required]),
    runtime: new FormControl('node', [Validators.required]),
    region: new FormControl('oregon', [Validators.required]),
    plan: new FormControl('starter', [Validators.required]),
    repoType: new FormControl('r2_managed', [Validators.required]),
    repoUrl: new FormControl(''),
    branch: new FormControl('main'),
    initialTemplate: new FormControl('discord-bot'),
    buildCommand: new FormControl('npm install'),
    startCommand: new FormControl('npm start', [Validators.required]),
    autoDeploy: new FormControl(true),
    envVars: new FormArray<FormGroup>([]),
  });

  get envVarsArray() {
    return this.form.get('envVars') as FormArray<FormGroup>;
  }

  addEnvVar(key = '', value = '') {
    this.envVarsArray.push(
      new FormGroup({
        key: new FormControl(key, [Validators.required]),
        value: new FormControl(value, [Validators.required]),
      })
    );
  }

  removeEnvVar(index: number) {
    this.envVarsArray.removeAt(index);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  removeSelectedFile(event?: Event) {
    if (event) event.stopPropagation();
    this.selectedFile.set(null);
  }

  private handleFile(file: File) {
    this.selectedFile.set(file);

    // Auto-suggest server name if not set
    if (!this.form.get('name')?.value) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/^-+|-+$/g, '');
      if (cleanName) {
        this.form.patchValue({ name: cleanName });
      }
    }

    // Auto-detect runtime and default commands
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.py') || lower.includes('python')) {
      this.form.patchValue({
        runtime: 'python',
        buildCommand: 'pip install -r requirements.txt || true',
        startCommand: 'python main.py',
      });
    } else if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.includes('node') || lower.includes('bot')) {
      this.form.patchValue({
        runtime: 'node',
        buildCommand: 'npm install',
        startCommand: 'npm start',
      });
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async onSubmit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    const val = this.form.value;

    const payload = {
      name: val.name!,
      description: val.description || undefined,
      serviceType: val.serviceType as any,
      runtime: val.runtime as any,
      region: val.region!,
      plan: val.plan!,
      repoType: val.repoType as any,
      repoUrl: val.repoUrl || undefined,
      branch: val.branch || 'main',
      initialTemplate: val.initialTemplate || undefined,
      buildCommand: val.buildCommand || 'npm install',
      startCommand: val.startCommand!,
      autoDeploy: val.autoDeploy !== false,
      envVars: (val.envVars || []).map((v: any) => ({
        key: v.key.trim(),
        value: v.value,
      })),
    };

    try {
      this.toast.info('Sending provisioning request to Render API...');
      const server = await this.serverService.createServer(payload);
      this.toast.success(`Render service '${server.name}' created!`);

      // If user uploaded a script / ZIP directly:
      const file = this.selectedFile();
      if (file && val.repoType === 'r2_managed') {
        this.toast.info(`Uploading ${file.name} to Cloudflare R2...`);
        const base64 = await this.readFileAsBase64(file);
        const isZip = file.name.endsWith('.zip');

        await this.fileService.uploadFile(
          server.id,
          file.name,
          base64,
          true,
          isZip, // auto-extract in R2
          ''
        );

        this.toast.success(`Uploaded ${file.name} to R2${isZip ? ' & auto-extracted' : ''}!`);
        this.toast.info('Syncing files to Git bridge & triggering Render deploy...');
        await this.fileService.syncDeploy(server.id);
      }

      this.router.navigate(['/servers', server.id, 'console']);
    } catch (err: any) {
      this.toast.error(err.error?.error || err.message || 'Service creation failed.');
    } finally {
      this.loading.set(false);
    }
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.split(',')[1] || '');
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}
