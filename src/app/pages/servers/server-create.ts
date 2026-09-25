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
    <div class="max-w-3xl mx-auto space-y-6">
      <div><a routerLink="/servers" class="text-xs text-neutral-400">Servers</a><h1 class="text-xl font-bold text-white">Deploy service</h1></div>
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input formControlName="name" placeholder="Service name" class="field" />
          <select formControlName="serviceType" class="field"><option value="background_worker">Background Worker</option><option value="web_service">Web Service</option><option value="private_service">Private Service</option><option value="cron_job">Cron Job</option></select>
          <select formControlName="runtime" class="field"><option value="node">Node.js</option><option value="python">Python</option><option value="docker">Docker</option></select>
          <select formControlName="region" class="field"><option value="oregon">Oregon</option><option value="ohio">Ohio</option><option value="frankfurt">Frankfurt</option><option value="singapore">Singapore</option></select>
        </div>
        <div class="rounded-xl border border-neutral-800 p-4 space-y-3">
          <label class="flex gap-2 text-sm text-white"><input type="radio" formControlName="deploymentSource" value="r2_zip" /> Upload ZIP to R2 and run</label>
          <label class="flex gap-2 text-sm text-white"><input type="radio" formControlName="deploymentSource" value="git" /> Git repository</label>
          @if (form.value.deploymentSource === 'git') { <input formControlName="repository" placeholder="https://github.com/owner/repository" class="field" /> }
          @if (form.value.deploymentSource === 'r2_zip') {
            <input type="file" accept=".zip" (change)="onFileSelected($event)" class="field" />
            @if (selectedFile()) { <div class="text-xs text-emerald-400">{{ selectedFile()?.name }} will be extracted automatically.</div> }
          }
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3"><input formControlName="buildCommand" placeholder="npm install" class="field" /><input formControlName="startCommand" placeholder="npm start" class="field" /></div>
        <button type="submit" [disabled]="loading() || form.invalid || hasNoQuota()" class="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">{{ loading() ? 'Deploying...' : 'Deploy' }}</button>
      </form>
    </div>
  `,
  styles: [`.field{width:100%;background:#0a0a0a;border:1px solid #262626;border-radius:.5rem;padding:.6rem;color:white;font-size:.8rem}`],
})
export class ServerCreate {
  readonly auth = inject(AuthService);
  readonly platformConfig = inject(PlatformConfigService);
  private serverService = inject(ServerService);
  private fileService = inject(FileService);
  private toast = inject(ToastService);
  readonly router = inject(Router);
  loading = signal(false);
  selectedFile = signal<File | null>(null);
  hasNoQuota = computed(() => { const user = this.auth.user(); return !user || (user.role !== 'SUPER_ADMIN' && (user.maxServers || 0) <= 0); });

  form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(3)]),
    serviceType: new FormControl('background_worker', { nonNullable: true, validators: Validators.required }),
    runtime: new FormControl('node', { nonNullable: true, validators: Validators.required }),
    region: new FormControl('oregon', { nonNullable: true, validators: Validators.required }),
    plan: new FormControl('starter', { nonNullable: true, validators: Validators.required }),
    deploymentSource: new FormControl('r2_zip', { nonNullable: true, validators: Validators.required }),
    repository: new FormControl(''),
    branch: new FormControl('main', { nonNullable: true }),
    buildCommand: new FormControl('npm install', { nonNullable: true }),
    startCommand: new FormControl('npm start', { nonNullable: true, validators: Validators.required }),
    autoDeploy: new FormControl(true, { nonNullable: true }),
    envVars: new FormArray<FormGroup>([]),
  });

  constructor() { this.platformConfig.load(); }
  onFileSelected(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (file) { this.selectedFile.set(file); if (file.name.toLowerCase().includes('python')) this.form.patchValue({ runtime: 'python', buildCommand: 'pip install -r requirements.txt || true', startCommand: 'python main.py' }); } }

  async onSubmit() {
    if (this.form.invalid || this.hasNoQuota()) return;
    this.loading.set(true);
    const value = this.form.getRawValue();
    const payload: any = {
      name: value.name,
      serviceType: value.serviceType,
      runtime: value.runtime,
      region: value.region,
      plan: value.plan,
      deploymentSource: value.deploymentSource,
      repository: value.deploymentSource === 'git' ? value.repository || undefined : undefined,
      branch: value.branch,
      buildCommand: value.buildCommand,
      startCommand: value.startCommand,
      autoDeploy: value.autoDeploy,
      envVars: [],
    };
    try {
      const server = await this.serverService.createServer(payload);
      const file = this.selectedFile();
      if (file && value.deploymentSource === 'r2_zip') {
        const base64 = await this.readFileAsBase64(file);
        await this.fileService.uploadFile(server.id, file.name, base64, true, true, '');
        await this.fileService.syncDeploy(server.id);
      }
      this.toast.success(`Service '${server.name}' deployed`);
      await this.router.navigate(['/servers', server.id, 'console']);
    } catch (err: any) { this.toast.error(err.error?.error?.message || err.error?.error || err.message || 'Deployment failed'); }
    finally { this.loading.set(false); }
  }

  private readFileAsBase64(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = reject; reader.readAsDataURL(file); }); }
}
