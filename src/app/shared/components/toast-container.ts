import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../core/services/toast.service.js';

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-200"
          [class.bg-emerald-950/90]="toast.type === 'success'"
          [class.border-emerald-800/60]="toast.type === 'success'"
          [class.text-emerald-200]="toast.type === 'success'"
          [class.bg-rose-950/90]="toast.type === 'error'"
          [class.border-rose-800/60]="toast.type === 'error'"
          [class.text-rose-200]="toast.type === 'error'"
          [class.bg-neutral-900/90]="toast.type === 'info'"
          [class.border-neutral-700/60]="toast.type === 'info'"
          [class.text-neutral-200]="toast.type === 'info'"
        >
          <mat-icon class="text-lg shrink-0 mt-0.5">
            @if (toast.type === 'success') { check_circle }
            @else if (toast.type === 'error') { error }
            @else { info }
          </mat-icon>
          <div class="flex-1 min-w-0 text-xs">
            @if (toast.title) {
              <div class="font-semibold mb-0.5 tracking-tight">{{ toast.title }}</div>
            }
            <div class="leading-relaxed break-words opacity-90">{{ toast.message }}</div>
          </div>
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="text-neutral-400 hover:text-white shrink-0 -mr-1 -mt-1 p-1 rounded transition-colors"
          >
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  readonly toastService = inject(ToastService);
}
