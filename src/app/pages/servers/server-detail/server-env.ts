import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { ServerService } from '../../../core/services/server.service.js';
import { ToastService } from '../../../core/services/toast.service.js';

@Component({
  selector: 'app-server-env',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="max-w-4xl space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div>
          <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <mat-icon class="text-emerald-400 text-base">vpn_key</mat-icon>
            <span>Environment Variables</span>
          </h2>
          <p class="text-xs text-neutral-400 mt-0.5">
            Variables are securely synced and encrypted on Render's native key-value engine.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="toggleRevealAll()"
            class="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <mat-icon class="text-sm">{{ showValues() ? 'visibility_off' : 'visibility' }}</mat-icon>
            <span>{{ showValues() ? 'Hide Values' : 'Reveal Values' }}</span>
          </button>

          <button
            type="button"
            (click)="addVariable()"
            class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <mat-icon class="text-sm">add</mat-icon>
            <span>Add Variable</span>
          </button>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="saveEnvVars()" class="space-y-4">
        @if (loading() && envVarsArray.length === 0) {
          <div class="p-12 text-center text-neutral-500 text-xs rounded-xl border border-neutral-800 bg-neutral-900/40">
            <mat-icon class="text-xl animate-spin mb-1">refresh</mat-icon>
            <div>Fetching environment variables from Render API...</div>
          </div>
        } @else if (envVarsArray.length === 0) {
          <div class="p-8 text-center text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-xl">
            No environment variables configured for this Render service yet.
          </div>
        } @else {
          <div class="space-y-2.5">
            @for (ctrl of envVarsArray.controls; track $index) {
              <div
                [formGroup]="$any(ctrl)"
                class="flex items-center gap-2 p-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors"
              >
                <!-- Key -->
                <div class="w-1/3">
                  <input
                    type="text"
                    formControlName="key"
                    placeholder="VARIABLE_NAME"
                    class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono uppercase outline-none"
                  />
                </div>

                <!-- Value -->
                <div class="flex-1 relative">
                  <input
                    [type]="showValues() ? 'text' : 'password'"
                    formControlName="value"
                    placeholder="Value..."
                    class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none pr-8"
                  />
                  <button
                    type="button"
                    (click)="copyValue(ctrl.value.value)"
                    title="Copy value"
                    class="absolute right-2 top-2 text-neutral-500 hover:text-white cursor-pointer"
                  >
                    <mat-icon class="text-xs">content_copy</mat-icon>
                  </button>
                </div>

                <!-- Delete -->
                <button
                  type="button"
                  (click)="removeVariable($index)"
                  class="p-1.5 rounded-lg hover:bg-rose-950/40 text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Remove"
                >
                  <mat-icon class="text-sm">delete</mat-icon>
                </button>
              </div>
            }
          </div>
        }

        <div class="flex items-center justify-between pt-3 border-t border-neutral-800/80">
          <div class="text-[11px] text-neutral-500">
            Saving sends a bulk update request directly to Render API v1.
          </div>

          <button
            type="submit"
            [disabled]="saving() || form.invalid"
            class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            @if (saving()) {
              <mat-icon class="text-sm animate-spin">refresh</mat-icon>
              <span>Updating Render Engine...</span>
            } @else {
              <mat-icon class="text-sm">save</mat-icon>
              <span>Save &amp; Apply Variables</span>
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ServerEnv implements OnInit {
  private route = inject(ActivatedRoute);
  private serverService = inject(ServerService);
  private toast = inject(ToastService);

  serverId = signal<string>('');
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  showValues = signal<boolean>(false);

  form = new FormGroup({
    envVars: new FormArray<FormGroup>([]),
  });

  get envVarsArray() {
    return this.form.get('envVars') as FormArray<FormGroup>;
  }

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.serverId.set(id);
        this.loadEnvVars();
      }
    });
  }

  async loadEnvVars() {
    this.loading.set(true);
    try {
      const vars = await this.serverService.getEnvVars(this.serverId());
      this.envVarsArray.clear();
      for (const item of vars) {
        this.envVarsArray.push(
          new FormGroup({
            key: new FormControl(item.key, [Validators.required]),
            value: new FormControl(item.value, []),
          })
        );
      }
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to load environment variables.');
    } finally {
      this.loading.set(false);
    }
  }

  addVariable() {
    this.envVarsArray.push(
      new FormGroup({
        key: new FormControl('', [Validators.required]),
        value: new FormControl('', []),
      })
    );
  }

  removeVariable(index: number) {
    this.envVarsArray.removeAt(index);
  }

  toggleRevealAll() {
    this.showValues.update((v) => !v);
  }

  copyValue(val: string) {
    navigator.clipboard.writeText(val || '');
    this.toast.info('Copied variable value to clipboard.');
  }

  async saveEnvVars() {
    if (this.form.invalid) return;
    this.saving.set(true);

    const raw = this.envVarsArray.value as Array<{ key: string; value: string }>;
    const payload = raw.map((item) => ({
      key: item.key.trim().toUpperCase(),
      value: item.value || '',
    }));

    try {
      this.toast.info('Updating environment variables on Render...');
      await this.serverService.updateEnvVars(this.serverId(), payload);
      this.toast.success('Environment variables updated on Render!');
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to save environment variables.');
    } finally {
      this.saving.set(false);
    }
  }
}
