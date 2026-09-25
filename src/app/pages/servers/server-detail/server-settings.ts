import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { ServerItem } from '../../../core/models/index.js';
import { ServerService } from '../../../core/services/server.service.js';
import { ToastService } from '../../../core/services/toast.service.js';

@Component({
  selector: 'app-server-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="max-w-3xl space-y-6">
      <div class="border-b border-neutral-800 pb-3">
        <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <mat-icon class="text-neutral-400 text-base">settings</mat-icon>
          <span>Server Settings</span>
        </h2>
        <p class="text-xs text-neutral-400 mt-0.5">
          General server identifiers and lifecycle options.
        </p>
      </div>

      <!-- Rename / General Form -->
      <form [formGroup]="form" (ngSubmit)="saveSettings()" class="space-y-4">
        <div class="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4">
          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1.5">Server Name</label>
            <input
              type="text"
              formControlName="name"
              placeholder="Server name"
              class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-neutral-400">
            <div>
              <span class="text-neutral-500">Internal Server ID:</span>
              <div class="text-white mt-0.5">{{ server()?.id }}</div>
            </div>
            <div>
              <span class="text-neutral-500">Render Service ID:</span>
              <div class="text-white mt-0.5">{{ server()?.renderServiceId }}</div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end">
          <button
            type="submit"
            [disabled]="loading() || form.invalid"
            class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            @if (loading()) {
              <mat-icon class="text-sm animate-spin">refresh</mat-icon>
            } @else {
              <mat-icon class="text-sm">save</mat-icon>
            }
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      <!-- Danger Zone -->
      <div class="p-5 rounded-xl border border-rose-900/60 bg-rose-950/20 space-y-4">
        <div class="flex items-center gap-2 text-rose-400">
          <mat-icon class="text-base">warning</mat-icon>
          <h3 class="text-xs font-bold uppercase tracking-wider font-mono">Danger Zone</h3>
        </div>
        <p class="text-xs text-neutral-400 leading-relaxed">
          Deleting this server will instruct the Render API to terminate and destroy the active service.
          This action cannot be undone.
        </p>

        <button
          type="button"
          (click)="showDeleteModal.set(true)"
          class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          <mat-icon class="text-sm">delete_forever</mat-icon>
          <span>Delete Server...</span>
        </button>
      </div>

      <!-- Delete Confirmation Modal -->
      @if (showDeleteModal()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div class="flex items-center gap-3 text-rose-400">
              <mat-icon class="text-xl">warning</mat-icon>
              <h3 class="text-sm font-bold text-white">Delete Server from Render</h3>
            </div>

            <p class="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to delete <span class="font-bold text-white">{{ server()?.name }}</span>?
              ZetaPanel will call Render API to permanently remove the service.
            </p>

            <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <label class="flex items-start gap-2.5 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  [formControl]="deleteFilesControl"
                  class="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-rose-500 focus:ring-rose-500"
                />
                <div>
                  <span class="font-medium text-white">Also delete Cloudflare R2 files</span>
                  <p class="text-[11px] text-neutral-500 mt-0.5">Purges all project assets and ZIP archives from R2 bucket.</p>
                </div>
              </label>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="showDeleteModal.set(false)"
                class="px-3.5 py-1.5 rounded-lg border border-neutral-800 text-xs font-medium text-neutral-300 hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="confirmDelete()"
                [disabled]="deleting()"
                class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                @if (deleting()) {
                  <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                  <span>Deleting on Render...</span>
                } @else {
                  <mat-icon class="text-sm">delete</mat-icon>
                  <span>Confirm Delete</span>
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ServerSettings implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serverService = inject(ServerService);
  private toast = inject(ToastService);

  serverId = signal<string>('');
  server = signal<ServerItem | null>(null);
  loading = signal<boolean>(false);
  deleting = signal<boolean>(false);

  showDeleteModal = signal<boolean>(false);
  deleteFilesControl = new FormControl(true);

  form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
  });

  ngOnInit() {
    this.route.parent?.paramMap.subscribe(async (params) => {
      const id = params.get('id');
      if (id) {
        this.serverId.set(id);
        const s = await this.serverService.getServer(id);
        this.server.set(s);
        this.form.patchValue({ name: s.name });
      }
    });
  }

  async saveSettings() {
    if (this.form.invalid) return;
    this.loading.set(true);

    try {
      this.toast.info('Updating server on Render API...');
      const updated = await this.serverService.updateServer(this.serverId(), {
        name: this.form.value.name!,
      });
      this.server.set(updated);
      this.toast.success('Server settings saved!');
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to update server.');
    } finally {
      this.loading.set(false);
    }
  }

  async confirmDelete() {
    this.deleting.set(true);
    try {
      this.toast.info('Requesting Render API to delete service...');
      await this.serverService.deleteServer(this.serverId(), this.deleteFilesControl.value === true);
      this.toast.success('Server successfully deleted from Render!');
      this.showDeleteModal.set(false);
      this.router.navigate(['/servers']);
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to delete server.');
    } finally {
      this.deleting.set(false);
    }
  }
}
