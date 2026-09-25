import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Plans } from '../plans/plans.js';

// Standalone, unauthenticated wrapper around the pricing grid so guests can
// see plans & pricing before creating an account. Mounted at /pricing,
// outside the authGuard-protected route tree.
@Component({
  selector: 'app-pricing-public',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Plans],
  template: `
    <div class="min-h-screen bg-neutral-950 font-sans selection:bg-emerald-500 selection:text-white">
      <header class="border-b border-neutral-800 px-4 sm:px-8 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <a routerLink="/login" class="flex items-center gap-2 cursor-pointer">
          <div class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-sm">
            Z
          </div>
          <span class="text-sm font-bold tracking-tight text-white">ZetaPanel</span>
        </a>
        <a
          routerLink="/login"
          class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          Masuk / Daftar
        </a>
      </header>

      <main class="px-4 sm:px-8 py-10">
        <app-plans></app-plans>
      </main>
    </div>
  `,
})
export class PricingPublic {}
