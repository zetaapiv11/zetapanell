import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { ServerItem } from '../../../core/models/index.js';
import { ServerService } from '../../../core/services/server.service.js';
import { ToastService } from '../../../core/services/toast.service.js';

@Component({
  selector: 'app-server-startup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="max-w-3xl space-y-6">
      <div class="border-b border-neutral-800 pb-3">
        <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <mat-icon class="text-emerald-400 text-base">play_circle</mat-icon>
          <span>Startup &amp; Build Configuration</span>
        </h2>
        <p class="text-xs text-neutral-400 mt-0.5">
          Modifying these values sends direct PATCH updates to the official Render API service.
        </p>
      </div>

      <form [formGroup]="form" (ngSubmit)="saveConfig()" class="space-y-5">
        <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Runtime</label>
              <input
                type="text"
                [value]="server()?.runtime || 'node'"
                disabled
                class="w-full bg-neutral-950/60 border border-neutral-800 text-neutral-500 rounded-lg px-3 py-2 text-xs font-mono cursor-not-allowed uppercase"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Service Type</label>
              <input
                type="text"
                [value]="server()?.serviceType || 'background_worker'"
                disabled
                class="w-full bg-neutral-950/60 border border-neutral-800 text-neutral-500 rounded-lg px-3 py-2 text-xs font-mono cursor-not-allowed"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Branch</label>
              <input
                type="text"
                formControlName="branch"
                placeholder="main"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Plan</label>
              <select
                formControlName="plan"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              >
                <option value="starter">Starter</option>
                <option value="standard">Standard</option>
                <option value="pro">Pro</option>
                <option value="free">Free</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1.5">Build Command</label>
            <input
              type="text"
              formControlName="buildCommand"
              placeholder="npm install"
              class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
            />
            <p class="text-[11px] text-neutral-500 mt-1">Command executed to assemble assets &amp; install dependencies.</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1.5">Start Command *</label>
            <input
              type="text"
              formControlName="startCommand"
              placeholder="npm start or node index.js"
              class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
            />
            <p class="text-[11px] text-neutral-500 mt-1">Primary daemon execution entrypoint.</p>
          </div>

          <div class="pt-2">
            <label class="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                formControlName="autoDeploy"
                class="rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Auto Deploy changes from git repository</span>
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3">
          <button
            type="submit"
            [disabled]="loading() || form.invalid"
            class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            @if (loading()) {
              <mat-icon class="text-sm animate-spin">refresh</mat-icon>
              <span>Updating Render Service...</span>
            } @else {
              <mat-icon class="text-sm">save</mat-icon>
              <span>Save &amp; Update on Render</span>
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ServerStartup implements OnInit {
  private route = inject(ActivatedRoute);
  private serverService = inject(ServerService);
  private toast = inject(ToastService);

  serverId = signal<string>('');
  server = signal<ServerItem | null>(null);
  loading = signal<boolean>(false);

  form = new FormGroup({
    branch: new FormControl('main'),
    plan: new FormControl('starter'),
    buildCommand: new FormControl('npm install'),
    startCommand: new FormControl('npm start', [Validators.required]),
    autoDeploy: new FormControl(true),
  });

  ngOnInit() {
    this.route.parent?.paramMap.subscribe(async (params) => {
      const id = params.get('id');
      if (id) {
        this.serverId.set(id);
        const s = await this.serverService.getServer(id);
        this.server.set(s);
        this.form.patchValue({
          branch: s.branch || 'main',
          plan: s.plan || 'starter',
          buildCommand: s.buildCommand || 'npm install',
          startCommand: s.startCommand || 'npm start',
          autoDeploy: s.autoDeploy !== false,
        });
      }
    });
  }

  async saveConfig() {
    if (this.form.invalid) return;
    this.loading.set(true);

    const val = this.form.value;
    try {
      this.toast.info('Sending updates to Render API...');
      const updated = await this.serverService.updateServer(this.serverId(), {
        branch: val.branch || 'main',
        plan: val.plan || 'starter',
        buildCommand: val.buildCommand || 'npm install',
        startCommand: val.startCommand!,
        autoDeploy: val.autoDeploy !== false,
      });
      this.server.set(updated);
      this.toast.success('Configuration saved on Render!');
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to update Render service.');
    } finally {
      this.loading.set(false);
    }
  }
}
