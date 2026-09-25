import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { FileItem } from '../../../core/models/index.js';
import { FileService } from '../../../core/services/file.service.js';
import { ToastService } from '../../../core/services/toast.service.js';
import { FileUpload } from './file-upload.js';

@Component({
  selector: 'app-server-files',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule, FileUpload],
  template: `
    <div class="space-y-4">
      <!-- Top Action Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-neutral-900/70 border border-neutral-800 rounded-xl">
        <!-- Breadcrumb Navigation -->
        <div class="flex items-center gap-1 text-xs font-mono overflow-x-auto">
          <button
            type="button"
            (click)="navigateTo('')"
            class="text-neutral-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <mat-icon class="text-sm">folder</mat-icon>
            <span>/</span>
          </button>
          @for (segment of breadcrumbSegments(); track $index) {
            <span class="text-neutral-600">/</span>
            <button
              type="button"
              (click)="navigateTo(getBreadcrumbPath($index))"
              class="text-neutral-300 hover:text-emerald-400 cursor-pointer transition-colors"
            >
              {{ segment }}
            </button>
          }
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            (click)="refreshFiles()"
            [disabled]="loading()"
            class="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
            title="Refresh Files"
          >
            <mat-icon class="text-sm" [class.animate-spin]="loading()">refresh</mat-icon>
          </button>

          <!-- Toggle Drag & Drop Upload Zone -->
          <button
            type="button"
            (click)="showUploader.set(!showUploader())"
            class="px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            [class.bg-emerald-950]="showUploader()"
            [class.border-emerald-700]="showUploader()"
            [class.text-emerald-300]="showUploader()"
            [class.border-neutral-800]="!showUploader()"
            [class.bg-neutral-900]="!showUploader()"
            [class.hover:bg-neutral-800]="!showUploader()"
            [class.text-neutral-200]="!showUploader()"
          >
            <mat-icon class="text-sm text-emerald-400">cloud_upload</mat-icon>
            <span>Upload Zone</span>
          </button>

          <!-- Quick Upload & Run Button -->
          <label
            class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Upload script or ZIP to Cloudflare R2 and deploy immediately to Render"
          >
            <mat-icon class="text-sm">bolt</mat-icon>
            <span>Upload &amp; Run</span>
            <input
              type="file"
              accept=".zip,.js,.py,.ts,.json,.tar.gz"
              (change)="onUploadAndRun($event)"
              class="hidden"
            />
          </label>

          <button
            type="button"
            (click)="openNewFileModal()"
            class="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <mat-icon class="text-sm">note_add</mat-icon>
            <span>New File</span>
          </button>

          <button
            type="button"
            (click)="openNewFolderModal()"
            class="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <mat-icon class="text-sm">create_new_folder</mat-icon>
            <span>New Folder</span>
          </button>

          <label
            class="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <mat-icon class="text-sm">upload_file</mat-icon>
            <span>Upload File</span>
            <input type="file" (change)="onFileUpload($event)" class="hidden" />
          </label>

          <button
            type="button"
            (click)="compressCurrentDirectory()"
            class="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            title="Compress current folder into ZIP archive"
          >
            <mat-icon class="text-sm">archive</mat-icon>
            <span>ZIP</span>
          </button>

          <!-- Sync & Deploy Button (Bridge requirement from Section 7 & 34) -->
          <button
            type="button"
            (click)="syncAndDeploy()"
            [disabled]="syncing()"
            class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ml-auto sm:ml-0"
            title="Sync all R2 files to Git bridge & trigger deploy on Render"
          >
            <mat-icon class="text-sm" [class.animate-spin]="syncing()">cloud_sync</mat-icon>
            <span>Sync &amp; Deploy</span>
          </button>

          <!-- Re-run server button -->
          <button
            type="button"
            (click)="reRunServer()"
            [disabled]="syncing()"
            class="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            title="Re-run container on Render and watch live logs"
          >
            <mat-icon class="text-sm text-emerald-400">play_circle</mat-icon>
            <span>Re-run</span>
          </button>
        </div>
      </div>

      <!-- Drag & Drop Uploader Component -->
      @if (showUploader()) {
        <app-file-upload
          [serverId]="serverId()"
          [targetDir]="currentDir()"
          (uploadFinished)="onUploadDone()"
        />
      }

      <!-- File Manager Table -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr class="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400 text-[11px] uppercase tracking-wider">
                <th class="py-2.5 px-4">Name</th>
                <th class="py-2.5 px-4">Size</th>
                <th class="py-2.5 px-4">Last Modified</th>
                <th class="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-800/60 text-neutral-300">
              @if (currentDir()) {
                <tr
                  (click)="navigateUp()"
                  class="hover:bg-neutral-800/30 cursor-pointer transition-colors"
                >
                  <td colspan="4" class="py-2.5 px-4 text-neutral-400 flex items-center gap-2">
                    <mat-icon class="text-base">arrow_upward</mat-icon>
                    <span>.. (Up one level)</span>
                  </td>
                </tr>
              }

              @if (loading() && files().length === 0) {
                <tr>
                  <td colspan="4" class="p-8 text-center text-neutral-500">
                    <mat-icon class="text-xl animate-spin mb-1">refresh</mat-icon>
                    <div>Connecting to Cloudflare R2 bucket...</div>
                  </td>
                </tr>
              } @else if (files().length === 0) {
                <tr>
                  <td colspan="4" class="p-8 text-center text-neutral-500 italic">
                    Directory is empty. Upload files or create a file above.
                  </td>
                </tr>
              } @else {
                @for (file of files(); track file.path) {
                  <tr class="hover:bg-neutral-800/40 transition-colors group">
                    <td class="py-2.5 px-4">
                      @if (file.isDir) {
                        <button
                          type="button"
                          (click)="navigateTo(file.path)"
                          class="flex items-center gap-2.5 text-neutral-200 hover:text-emerald-400 cursor-pointer font-medium"
                        >
                          <mat-icon class="text-base text-amber-400">folder</mat-icon>
                          <span>{{ file.name }}</span>
                        </button>
                      } @else {
                        <button
                          type="button"
                          (click)="openFileEditor(file.path)"
                          class="flex items-center gap-2.5 text-neutral-300 hover:text-white cursor-pointer"
                        >
                          <mat-icon class="text-base text-neutral-500 group-hover:text-emerald-400">
                            @if (file.name.endsWith('.zip')) { inventory_2 }
                            @else if (file.name.endsWith('.json')) { data_object }
                            @else if (file.name.endsWith('.js') || file.name.endsWith('.ts')) { code }
                            @else { description }
                          </mat-icon>
                          <span>{{ file.name }}</span>
                        </button>
                      }
                    </td>
                    <td class="py-2.5 px-4 text-neutral-400 tabular-nums">
                      {{ file.isDir ? '-' : formatBytes(file.size) }}
                    </td>
                    <td class="py-2.5 px-4 text-neutral-500 text-[11px] tabular-nums">
                      {{ file.modified.slice(0, 16).replace('T', ' ') }}
                    </td>
                    <td class="py-2.5 px-4 text-right">
                      <div class="inline-flex items-center gap-1">
                        @if (!file.isDir && file.name.endsWith('.zip')) {
                          <button
                            type="button"
                            (click)="extractZip(file.path)"
                            title="Extract ZIP into R2"
                            class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <mat-icon class="text-sm">unarchive</mat-icon>
                          </button>
                        }

                        @if (!file.isDir) {
                          <button
                            type="button"
                            (click)="downloadFile(file.path)"
                            title="Download file"
                            class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <mat-icon class="text-sm">download</mat-icon>
                          </button>
                          <button
                            type="button"
                            (click)="openFileEditor(file.path)"
                            title="Edit file"
                            class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <mat-icon class="text-sm">edit</mat-icon>
                          </button>
                        }

                        <button
                          type="button"
                          (click)="openRenameModal(file)"
                          title="Rename"
                          class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          <mat-icon class="text-sm">drive_file_rename_outline</mat-icon>
                        </button>

                        <button
                          type="button"
                          (click)="deleteFile(file)"
                          title="Delete"
                          class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <mat-icon class="text-sm">delete</mat-icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- File Editor Modal / Drawer -->
      @if (editingFile()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div class="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-950">
              <div class="flex items-center gap-2">
                <mat-icon class="text-emerald-400 text-sm">edit_note</mat-icon>
                <span class="text-xs font-mono font-semibold text-white truncate max-w-md">
                  {{ editingFilePath() }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="saveFile()"
                  [disabled]="savingFile()"
                  class="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <mat-icon class="text-sm" [class.animate-spin]="savingFile()">save</mat-icon>
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  (click)="saveAndRerun()"
                  [disabled]="savingFile()"
                  class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  title="Save changes to Cloudflare R2 and re-run on Render"
                >
                  <mat-icon class="text-sm">bolt</mat-icon>
                  <span>Save &amp; Re-run</span>
                </button>
                <button
                  type="button"
                  (click)="closeFileEditor()"
                  class="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <mat-icon class="text-sm">close</mat-icon>
                </button>
              </div>
            </div>

            <div class="flex-1 p-2 bg-neutral-950 overflow-hidden flex flex-col">
              <textarea
                [formControl]="fileContentControl"
                spellcheck="false"
                class="w-full h-[520px] bg-neutral-950 text-neutral-200 font-mono text-xs p-4 outline-none resize-none selection:bg-emerald-500 selection:text-white"
                placeholder="Enter file contents..."
              ></textarea>
            </div>
          </div>
        </div>
      }

      <!-- New File Modal -->
      @if (showNewFileModal()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <mat-icon class="text-emerald-400 text-base">note_add</mat-icon>
                <span>Create New File in R2</span>
              </h3>
              <button type="button" (click)="showNewFileModal.set(false)" class="text-neutral-400 hover:text-white">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">File Name</label>
              <input
                type="text"
                [formControl]="newFileNameControl"
                placeholder="e.g. index.js or config.json"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="showNewFileModal.set(false)"
                class="px-3 py-1.5 rounded-lg border border-neutral-800 text-xs font-medium text-neutral-300 hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="createNewFile()"
                class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      }

      <!-- New Folder Modal -->
      @if (showNewFolderModal()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <mat-icon class="text-amber-400 text-base">create_new_folder</mat-icon>
                <span>Create New Folder in R2</span>
              </h3>
              <button type="button" (click)="showNewFolderModal.set(false)" class="text-neutral-400 hover:text-white">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">Folder Name</label>
              <input
                type="text"
                [formControl]="newFolderNameControl"
                placeholder="e.g. src or commands"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="showNewFolderModal.set(false)"
                class="px-3 py-1.5 rounded-lg border border-neutral-800 text-xs font-medium text-neutral-300 hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="createNewFolder()"
                class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Rename Modal -->
      @if (showRenameModal()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <mat-icon class="text-amber-400 text-base">drive_file_rename_outline</mat-icon>
                <span>Rename Item</span>
              </h3>
              <button type="button" (click)="showRenameModal.set(false)" class="text-neutral-400 hover:text-white">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1.5">New Name</label>
              <input
                type="text"
                [formControl]="renameControl"
                class="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="showRenameModal.set(false)"
                class="px-3 py-1.5 rounded-lg border border-neutral-800 text-xs font-medium text-neutral-300 hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="confirmRename()"
                class="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ServerFiles implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fileService = inject(FileService);
  private toast = inject(ToastService);

  serverId = signal<string>('');
  currentDir = signal<string>('');
  files = signal<FileItem[]>([]);
  loading = signal<boolean>(false);
  syncing = signal<boolean>(false);
  showUploader = signal<boolean>(false);

  // Editor State
  editingFile = signal<boolean>(false);
  editingFilePath = signal<string>('');
  fileContentControl = new FormControl('');
  savingFile = signal<boolean>(false);

  // Modals
  showNewFileModal = signal<boolean>(false);
  newFileNameControl = new FormControl('');

  showNewFolderModal = signal<boolean>(false);
  newFolderNameControl = new FormControl('');

  showRenameModal = signal<boolean>(false);
  renameTarget = signal<FileItem | null>(null);
  renameControl = new FormControl('');

  readonly breadcrumbSegments = computed(() => {
    const dir = this.currentDir();
    return dir ? dir.split('/').filter(Boolean) : [];
  });

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.serverId.set(id);
        this.refreshFiles();
      }
    });
  }

  getBreadcrumbPath(index: number): string {
    const segments = this.breadcrumbSegments();
    return segments.slice(0, index + 1).join('/');
  }

  navigateTo(dir: string) {
    this.currentDir.set(dir);
    this.refreshFiles();
  }

  navigateUp() {
    const segments = this.breadcrumbSegments();
    segments.pop();
    this.currentDir.set(segments.join('/'));
    this.refreshFiles();
  }

  async refreshFiles() {
    this.loading.set(true);
    try {
      const list = await this.fileService.listFiles(this.serverId(), this.currentDir());
      this.files.set(list);
    } catch (err: any) {
      this.toast.error(err.message || 'Could not list files from Cloudflare R2.');
    } finally {
      this.loading.set(false);
    }
  }

  async openFileEditor(path: string) {
    try {
      this.toast.info(`Fetching ${path} from R2...`);
      const content = await this.fileService.getFileContent(this.serverId(), path);
      this.editingFilePath.set(path);
      this.fileContentControl.setValue(content);
      this.editingFile.set(true);
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to open file.');
    }
  }

  closeFileEditor() {
    this.editingFile.set(false);
    this.editingFilePath.set('');
  }

  async saveFile() {
    this.savingFile.set(true);
    try {
      await this.fileService.saveFileContent(
        this.serverId(),
        this.editingFilePath(),
        this.fileContentControl.value || ''
      );
      this.toast.success('File saved to Cloudflare R2!');
      this.closeFileEditor();
      this.refreshFiles();
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to save file.');
    } finally {
      this.savingFile.set(false);
    }
  }

  async saveAndRerun() {
    this.savingFile.set(true);
    try {
      await this.fileService.saveFileContent(
        this.serverId(),
        this.editingFilePath(),
        this.fileContentControl.value || ''
      );
      this.toast.success('File saved to Cloudflare R2!');
      this.closeFileEditor();
      this.refreshFiles();

      this.toast.info('Syncing changes and re-running on Render...');
      await this.syncAndDeploy();
      this.router.navigate(['/servers', this.serverId(), 'console']);
    } catch (err: any) {
      this.toast.error(err.message || 'Save & re-run failed.');
    } finally {
      this.savingFile.set(false);
    }
  }

  async reRunServer() {
    this.syncing.set(true);
    try {
      this.toast.info('Triggering immediate sync & re-run on Render...');
      await this.fileService.syncDeploy(this.serverId());
      this.toast.success('Re-run triggered successfully!');
      this.router.navigate(['/servers', this.serverId(), 'console']);
    } catch (err: any) {
      this.toast.error(err.message || 'Re-run failed.');
    } finally {
      this.syncing.set(false);
    }
  }

  onUploadDone() {
    this.refreshFiles();
  }

  openNewFileModal() {
    this.newFileNameControl.setValue('');
    this.showNewFileModal.set(true);
  }

  async createNewFile() {
    const name = this.newFileNameControl.value?.trim();
    if (!name) return;

    const fullPath = this.currentDir() ? `${this.currentDir()}/${name}` : name;
    try {
      await this.fileService.saveFileContent(this.serverId(), fullPath, '');
      this.toast.success(`Created file ${name}`);
      this.showNewFileModal.set(false);
      this.refreshFiles();
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to create file.');
    }
  }

  openNewFolderModal() {
    this.newFolderNameControl.setValue('');
    this.showNewFolderModal.set(true);
  }

  async createNewFolder() {
    const name = this.newFolderNameControl.value?.trim();
    if (!name) return;

    const fullPath = this.currentDir() ? `${this.currentDir()}/${name}` : name;
    try {
      await this.fileService.createFolder(this.serverId(), fullPath);
      this.toast.success(`Created folder ${name}`);
      this.showNewFolderModal.set(false);
      this.refreshFiles();
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to create folder.');
    }
  }

  openRenameModal(file: FileItem) {
    this.renameTarget.set(file);
    this.renameControl.setValue(file.name);
    this.showRenameModal.set(true);
  }

  async confirmRename() {
    const target = this.renameTarget();
    const newName = this.renameControl.value?.trim();
    if (!target || !newName || newName === target.name) {
      this.showRenameModal.set(false);
      return;
    }

    const parent = this.currentDir();
    const newPath = parent ? `${parent}/${newName}` : newName;

    try {
      await this.fileService.renameFile(this.serverId(), target.path, newPath);
      this.toast.success('Renamed successfully in R2.');
      this.showRenameModal.set(false);
      this.refreshFiles();
    } catch (err: any) {
      this.toast.error(err.message || 'Rename failed.');
    }
  }

  async deleteFile(file: FileItem) {
    if (!confirm(`Are you sure you want to delete ${file.isDir ? 'folder' : 'file'} "${file.name}"?`)) {
      return;
    }

    try {
      await this.fileService.deleteFile(this.serverId(), file.path, file.isDir);
      this.toast.success(`Deleted ${file.name}`);
      this.refreshFiles();
    } catch (err: any) {
      this.toast.error(err.message || 'Delete failed.');
    }
  }

  async onFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    this.toast.info(`Uploading ${file.name} to Cloudflare R2...`);

    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const isZip = file.name.endsWith('.zip');
        const targetPath = this.currentDir() ? `${this.currentDir()}/${file.name}` : file.name;

        await this.fileService.uploadFile(
          this.serverId(),
          targetPath,
          base64,
          true,
          isZip, // auto-extract if zip
          this.currentDir()
        );

        this.toast.success(`Uploaded ${file.name}${isZip ? ' and extracted contents' : ''}!`);
        this.refreshFiles();
      } catch (err: any) {
        this.toast.error(err.message || 'Upload failed.');
      } finally {
        input.value = '';
      }
    };

    reader.readAsDataURL(file);
  }

  async onUploadAndRun(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    this.toast.info(`Uploading ${file.name} to Cloudflare R2...`);

    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const isZip = file.name.endsWith('.zip');
        const targetPath = this.currentDir() ? `${this.currentDir()}/${file.name}` : file.name;

        await this.fileService.uploadFile(
          this.serverId(),
          targetPath,
          base64,
          true,
          isZip, // auto-extract zip in Cloudflare R2
          this.currentDir()
        );

        this.toast.success(`Uploaded ${file.name} to R2${isZip ? ' & auto-extracted' : ''}!`);
        this.refreshFiles();

        // Now automatically sync to Git bridge and trigger deploy on Render!
        this.toast.info('Triggering immediate build & run on Render...');
        await this.syncAndDeploy();

        // Navigate to console so user sees live logs
        this.router.navigate(['/servers', this.serverId(), 'console']);
      } catch (err: any) {
        this.toast.error(err.message || 'Upload & Run failed.');
      } finally {
        input.value = '';
      }
    };

    reader.readAsDataURL(file);
  }

  async extractZip(zipPath: string) {
    try {
      this.toast.info(`Extracting ${zipPath} in R2...`);
      const res = await this.fileService.extractZip(this.serverId(), zipPath, this.currentDir());
      this.toast.success(`Extracted ${res.filesExtracted} files!`);
      this.refreshFiles();
    } catch (err: any) {
      this.toast.error(err.message || 'Extraction failed.');
    }
  }

  async compressCurrentDirectory() {
    try {
      this.toast.info('Compressing files into archive.zip...');
      await this.fileService.compressZip(this.serverId(), this.currentDir(), 'archive.zip');
      this.toast.success('archive.zip created in Cloudflare R2!');
      this.refreshFiles();
    } catch (err: any) {
      this.toast.error(err.message || 'Compression failed.');
    }
  }

  async downloadFile(path: string) {
    try {
      const url = await this.fileService.getDownloadUrl(this.serverId(), path);
      window.open(url, '_blank');
    } catch (err: any) {
      this.toast.error(err.message || 'Download failed.');
    }
  }

  async syncAndDeploy() {
    this.syncing.set(true);
    try {
      this.toast.info('Syncing R2 files to Git bridge & triggering Render deploy...');
      await this.fileService.syncDeploy(this.serverId());
      this.toast.success('Synced to Render! Deployment started.');
    } catch (err: any) {
      this.toast.error(err.message || 'Sync & deploy failed.');
    } finally {
      this.syncing.set(false);
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
