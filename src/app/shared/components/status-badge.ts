import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1.5 font-mono text-xs font-medium tabular-nums tracking-wide">
      <span
        class="inline-block w-2 h-2 rounded-full shrink-0"
        [class.bg-emerald-500]="status() === 'ONLINE'"
        [class.shadow-emerald-500/50]="status() === 'ONLINE'"
        [class.bg-amber-400]="status() === 'BUILDING' || status() === 'DEPLOYING'"
        [class.animate-pulse]="status() === 'BUILDING' || status() === 'DEPLOYING' || status() === 'CREATING'"
        [class.bg-sky-400]="status() === 'CREATING'"
        [class.bg-rose-500]="status() === 'FAILED'"
        [class.bg-neutral-500]="status() === 'SUSPENDED' || status() === 'DELETED' || status() === 'UNKNOWN'"
      ></span>
      <span
        [class.text-emerald-400]="status() === 'ONLINE'"
        [class.text-amber-400]="status() === 'BUILDING' || status() === 'DEPLOYING'"
        [class.text-sky-400]="status() === 'CREATING'"
        [class.text-rose-400]="status() === 'FAILED'"
        [class.text-neutral-400]="status() === 'SUSPENDED' || status() === 'DELETED' || status() === 'UNKNOWN'"
      >
        {{ status() }}
      </span>
    </span>
  `,
})
export class StatusBadge {
  readonly status = input<string>('UNKNOWN');
}
