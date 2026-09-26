import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type DeployStepState = 'pending' | 'active' | 'done' | 'error';

export interface DeployStep {
  key: string;
  label: string;
  icon: string;
  state: DeployStepState;
  detail?: string;
}

@Component({
  selector: 'app-deploy-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (visible()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

        <!-- Modal -->
        <div
          class="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl shadow-black/50 overflow-hidden"
        >
          <div class="p-5 border-b border-neutral-800 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <mat-icon class="text-base text-emerald-400" [class.animate-spin]="isBusy()">
                {{ isBusy() ? 'autorenew' : hasError() ? 'error' : 'check_circle' }}
              </mat-icon>
            </div>
            <div>
              <h3 class="text-sm font-bold text-white">
                {{ hasError() ? 'Deploy failed' : isBusy() ? 'Deploying...' : 'Deploy complete' }}
              </h3>
              <p class="text-[11px] text-neutral-500">{{ title() }}</p>
            </div>
          </div>

          <div class="p-5 space-y-0.5">
            @for (step of steps(); track step.key; let last = $last) {
              <div class="flex gap-3">
                <!-- Icon + connecting line -->
                <div class="flex flex-col items-center">
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors duration-300"
                    [class.border-neutral-700]="step.state === 'pending'"
                    [class.bg-neutral-900]="step.state === 'pending'"
                    [class.border-emerald-500]="step.state === 'active' || step.state === 'done'"
                    [class.bg-emerald-950]="step.state === 'active'"
                    [class.bg-emerald-500]="step.state === 'done'"
                    [class.border-rose-500]="step.state === 'error'"
                    [class.bg-rose-950]="step.state === 'error'"
                  >
                    @switch (step.state) {
                      @case ('pending') {
                        <mat-icon class="text-sm text-neutral-600">{{ step.icon }}</mat-icon>
                      }
                      @case ('active') {
                        <mat-icon class="text-sm text-emerald-400 animate-spin">refresh</mat-icon>
                      }
                      @case ('done') {
                        <mat-icon class="text-sm text-white">check</mat-icon>
                      }
                      @case ('error') {
                        <mat-icon class="text-sm text-rose-400">close</mat-icon>
                      }
                    }
                  </div>
                  @if (!last) {
                    <div
                      class="w-0.5 flex-1 min-h-[22px] transition-colors duration-300"
                      [class.bg-emerald-500]="step.state === 'done'"
                      [class.bg-neutral-800]="step.state !== 'done'"
                    ></div>
                  }
                </div>

                <!-- Label -->
                <div class="pb-5 pt-0.5">
                  <div
                    class="text-xs font-semibold transition-colors"
                    [class.text-neutral-600]="step.state === 'pending'"
                    [class.text-white]="step.state === 'active' || step.state === 'done'"
                    [class.text-rose-400]="step.state === 'error'"
                  >
                    {{ step.label }}
                  </div>
                  @if (step.detail) {
                    <div class="text-[11px] text-neutral-500 mt-0.5">{{ step.detail }}</div>
                  }
                </div>
              </div>
            }
          </div>

          @if (!isBusy()) {
            <div class="p-4 border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                (click)="closed.emit()"
                class="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class DeployProgress {
  visible = input<boolean>(false);
  title = input<string>('');
  steps = input<DeployStep[]>([]);

  closed = output<void>();

  isBusy(): boolean {
    return this.steps().some((s) => s.state === 'active');
  }

  hasError(): boolean {
    return this.steps().some((s) => s.state === 'error');
  }
}
