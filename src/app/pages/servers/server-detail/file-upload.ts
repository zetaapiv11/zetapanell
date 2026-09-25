import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { FileService } from '../../../core/services/file.service.js';
import { ToastService } from '../../../core/services/toast.service.js';

export interface StagedFile {
  file: File;
  name: string;
  size: number;
  isZip: boolean;
  status: 'pending' | 'uploading' | 'extracted' | 'done' | 'error';
  error?: string;
}

@Component({
  selector: 'app-file-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-4 font-sans">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <mat-icon class="text-base">cloud_upload</mat-icon>
          </div>
          <div>
            <h3 class="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Cloudflare R2 Direct Uploader</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 font-mono">AWS S3 SDK</span>
            </h3>
            <p class="text-[11px] text-neutral-400">
              Drag and drop scripts or ZIP packages directly into Cloudflare R2 storage.
            </p>
          </div>
        </div>

        @if (stagedFiles().length > 0) {
          <button
            type="button"
            (click)="clearFiles()"
            class="text-[11px] text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Clear ({{ stagedFiles().length }})
          </button>
        }
      </div>

      <!-- Drag & Drop Zone -->
      <div
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        class="border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer relative"
        [class.border-emerald-500]="isDragging()"
        [class.bg-emerald-950/20]="isDragging()"
        [class.border-neutral-800]="!isDragging()"
        [class.bg-neutral-950]="!isDragging()"
      >
        <mat-icon class="text-3xl text-neutral-500 mb-1">file_upload</mat-icon>
        <div class="text-xs font-semibold text-neutral-200">
          Drop your scripts or .zip archives here
        </div>
        <div class="text-[11px] text-neutral-500 mt-0.5">
          Supports <span class="font-mono text-neutral-300">.zip</span>, <span class="font-mono text-neutral-300">.js</span>, <span class="font-mono text-neutral-300">.py</span>, <span class="font-mono text-neutral-300">.ts</span>, <span class="font-mono text-neutral-300">.json</span>, <span class="font-mono text-neutral-300">.tar.gz</span>
        </div>

        <label
          class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer transition-colors border border-neutral-700"
        >
          <mat-icon class="text-sm">folder_open</mat-icon>
          <span>Select Files from Device</span>
          <input
            type="file"
            multiple
            accept=".zip,.js,.py,.ts,.json,.tar.gz,.env,.txt,.md,.yaml,.yml"
            (change)="onFileInputChange($event)"
            class="hidden"
          />
        </label>
      </div>

      <!-- Staged Files List -->
      @if (stagedFiles().length > 0) {
        <div class="space-y-2">
          <div class="text-[11px] font-mono font-medium text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Staged Files ({{ stagedFiles().length }})</span>
            <span class="text-neutral-500 lowercase">Target: /{{ targetDir() || 'root' }}</span>
          </div>

          <div class="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
            @for (item of stagedFiles(); track item.name) {
              <div class="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-800/80">
                <div class="flex items-center gap-2 min-w-0">
                  <mat-icon class="text-sm" [class.text-amber-400]="item.isZip" [class.text-emerald-400]="!item.isZip">
                    {{ item.isZip ? 'folder_zip' : 'description' }}
                  </mat-icon>
                  <span class="text-neutral-200 truncate">{{ item.name }}</span>
                  <span class="text-[10px] text-neutral-500">({{ formatBytes(item.size) }})</span>
                  @if (item.isZip) {
                    <span class="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[10px] border border-amber-500/20">
                      Auto-Extract
                    </span>
                  }
                </div>

                <div class="flex items-center gap-2">
                  @switch (item.status) {
                    @case ('uploading') {
                      <mat-icon class="text-xs text-emerald-400 animate-spin">refresh</mat-icon>
                    }
                    @case ('done') {
                      <mat-icon class="text-xs text-emerald-400">check_circle</mat-icon>
                    }
                    @case ('error') {
                      <mat-icon class="text-xs text-rose-400" [title]="item.error || 'Failed'">error</mat-icon>
                    }
                    @default {
                      <button
                        type="button"
                        (click)="removeStagedFile(item)"
                        class="text-neutral-500 hover:text-rose-400 cursor-pointer"
                      >
                        <mat-icon class="text-xs">close</mat-icon>
                      </button>
                    }
                  }
                </div>
              </div>
            }
          </div>

          <!-- Upload Options -->
          <div class="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-neutral-800 text-xs">
            <div class="flex items-center gap-4">
              <label class="inline-flex items-center gap-1.5 text-neutral-300 text-[11px] cursor-pointer">
                <input type="checkbox" [formControl]="autoExtractControl" class="rounded text-emerald-500 focus:ring-emerald-500" />
                <span>Auto-Extract ZIP archives</span>
              </label>

              <label class="inline-flex items-center gap-1.5 text-neutral-300 text-[11px] cursor-pointer">
                <input type="checkbox" [formControl]="autoRerunControl" class="rounded text-emerald-500 focus:ring-emerald-500" />
                <span>Auto Re-run on Render after upload</span>
              </label>
            </div>

            <button
              type="button"
              (click)="uploadAll()"
              [disabled]="uploading()"
              class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ml-auto"
            >
              @if (uploading()) {
                <mat-icon class="text-sm animate-spin">refresh</mat-icon>
                <span>Uploading to R2...</span>
              } @else {
                <mat-icon class="text-sm">bolt</mat-icon>
                <span>Upload &amp; {{ autoRerunControl.value ? 'Re-run Server' : 'Save' }}</span>
              }
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class FileUpload {
  serverId = input.required<string>();
  targetDir = input<string>('');

  uploadFinished = output<void>();

  private fileService = inject(FileService);
  private toast = inject(ToastService);
  private router = inject(Router);

  isDragging = signal<boolean>(false);
  uploading = signal<boolean>(false);
  stagedFiles = signal<StagedFile[]>([]);

  autoExtractControl = new FormControl(true);
  autoRerunControl = new FormControl(true);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  addFiles(files: File[]) {
    const newItems: StagedFile[] = files.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      isZip: file.name.endsWith('.zip'),
      status: 'pending',
    }));

    this.stagedFiles.update((curr) => [...curr, ...newItems]);
  }

  removeStagedFile(item: StagedFile) {
    this.stagedFiles.update((curr) => curr.filter((f) => f.name !== item.name));
  }

  clearFiles() {
    this.stagedFiles.set([]);
  }

  async uploadAll() {
    const items = this.stagedFiles();
    if (items.length === 0 || this.uploading()) return;

    this.uploading.set(true);
    const serverId = this.serverId();
    const dir = this.targetDir();
    const shouldExtract = this.autoExtractControl.value ?? true;
    const shouldRerun = this.autoRerunControl.value ?? true;

    try {
      for (const item of items) {
        item.status = 'uploading';
        this.stagedFiles.set([...items]);

        const base64 = await this.readFileAsBase64(item.file);
        const targetPath = dir ? `${dir}/${item.name}` : item.name;

        await this.fileService.uploadFile(
          serverId,
          targetPath,
          base64,
          true,
          shouldExtract && item.isZip,
          dir
        );

        item.status = 'done';
        this.stagedFiles.set([...items]);
      }

      this.toast.success(`Successfully uploaded ${items.length} file(s) to Cloudflare R2!`);
      this.uploadFinished.emit();

      if (shouldRerun) {
        this.toast.info('Triggering server sync and re-run on Render...');
        await this.fileService.syncDeploy(serverId);
        this.router.navigate(['/servers', serverId, 'console']);
      } else {
        this.clearFiles();
      }
    } catch (err: any) {
      this.toast.error(err.message || 'Upload to R2 failed.');
    } finally {
      this.uploading.set(false);
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

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
