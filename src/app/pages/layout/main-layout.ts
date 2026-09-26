import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service.js';
import { ToastContainer } from '../../shared/components/toast-container.js';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, ToastContainer],
  template: `
    <div class="min-h-screen bg-neutral-800 text-neutral-200 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      <!-- Top Navigation Bar -- matches Pterodactyl's NavigationBar.tsx exactly:
           slim bg-neutral-900 bar, logo left, icon-only links right, cyan
           underline + black background on hover/active. No sidebar. -->
      <div class="w-full bg-neutral-900 shadow-md overflow-x-auto shrink-0">
        <div class="mx-auto w-full flex items-center h-[3.5rem] max-w-[1200px]">
          <div class="flex-1">
            <a
              routerLink="/dashboard"
              class="text-2xl font-medium px-4 no-underline text-neutral-200 hover:text-neutral-100 transition-colors duration-150"
            >
              ZetaPanel
            </a>
          </div>

          <div class="flex h-full items-center justify-center">
            <a
              routerLink="/dashboard"
              routerLinkActive="bg-black shadow-[inset_0_-2px_0_var(--color-cyan-500)] text-neutral-100"
              [routerLinkActiveOptions]="{ exact: true }"
              title="Dashboard"
              class="flex items-center h-full no-underline text-neutral-300 px-6 cursor-pointer transition-all duration-150 hover:text-neutral-100 hover:bg-black"
            >
              <mat-icon>dashboard</mat-icon>
            </a>

            <a
              routerLink="/servers"
              routerLinkActive="bg-black shadow-[inset_0_-2px_0_var(--color-cyan-500)] text-neutral-100"
              title="Servers"
              class="flex items-center h-full no-underline text-neutral-300 px-6 cursor-pointer transition-all duration-150 hover:text-neutral-100 hover:bg-black"
            >
              <mat-icon>dns</mat-icon>
            </a>

            @if (auth.isAdmin()) {
              <a
                routerLink="/admin"
                routerLinkActive="bg-black shadow-[inset_0_-2px_0_var(--color-cyan-500)] text-neutral-100"
                title="Admin"
                class="flex items-center h-full no-underline text-neutral-300 px-6 cursor-pointer transition-all duration-150 hover:text-neutral-100 hover:bg-black"
              >
                <mat-icon>settings</mat-icon>
              </a>
            }

            <a
              routerLink="/account"
              routerLinkActive="bg-black shadow-[inset_0_-2px_0_var(--color-cyan-500)] text-neutral-100"
              title="Account Settings"
              class="flex items-center h-full no-underline text-neutral-300 px-6 cursor-pointer transition-all duration-150 hover:text-neutral-100 hover:bg-black"
            >
              <span class="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-[10px] uppercase">
                {{ auth.user()?.username?.charAt(0) || 'U' }}
              </span>
            </a>

            <button
              type="button"
              (click)="logout()"
              title="Sign Out"
              class="flex items-center h-full no-underline text-neutral-300 px-6 cursor-pointer transition-all duration-150 hover:text-neutral-100 hover:bg-black bg-transparent border-none"
            >
              <mat-icon>logout</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Secondary quick-links bar: API Keys / Activity / Plans / Docs --
           Pterodactyl doesn't have this (those live inside Account settings
           in the real panel), but ZetaPanel needs somewhere to put them
           since it has more top-level sections than a game server panel. -->
      <div class="w-full bg-neutral-700 shadow overflow-x-auto shrink-0">
        <div class="mx-auto w-full max-w-[1200px] flex items-center text-sm px-2">
          <a
            routerLink="/plans"
            routerLinkActive="text-neutral-100 shadow-[inset_0_-2px_0_var(--color-cyan-500)]"
            class="inline-flex items-center gap-1.5 py-2.5 px-4 text-neutral-300 no-underline whitespace-nowrap transition-all duration-150 hover:text-neutral-100 cursor-pointer"
          >
            <mat-icon class="text-base">payments</mat-icon>
            <span>Plans &amp; Pricing</span>
          </a>
          <a
            routerLink="/api-keys"
            routerLinkActive="text-neutral-100 shadow-[inset_0_-2px_0_var(--color-cyan-500)]"
            class="inline-flex items-center gap-1.5 py-2.5 px-4 text-neutral-300 no-underline whitespace-nowrap transition-all duration-150 hover:text-neutral-100 cursor-pointer"
          >
            <mat-icon class="text-base">vpn_key</mat-icon>
            <span>API Keys</span>
          </a>
          <a
            routerLink="/activity"
            routerLinkActive="text-neutral-100 shadow-[inset_0_-2px_0_var(--color-cyan-500)]"
            class="inline-flex items-center gap-1.5 py-2.5 px-4 text-neutral-300 no-underline whitespace-nowrap transition-all duration-150 hover:text-neutral-100 cursor-pointer"
          >
            <mat-icon class="text-base">history</mat-icon>
            <span>Activity Logs</span>
          </a>
          <a
            routerLink="/docs"
            routerLinkActive="text-neutral-100 shadow-[inset_0_-2px_0_var(--color-cyan-500)]"
            class="inline-flex items-center gap-1.5 py-2.5 px-4 text-neutral-300 no-underline whitespace-nowrap transition-all duration-150 hover:text-neutral-100 cursor-pointer"
          >
            <mat-icon class="text-base">menu_book</mat-icon>
            <span>Documentation</span>
          </a>
          <div class="flex-1"></div>
          <a
            routerLink="/servers/new"
            class="my-2 mr-2 px-4 py-2 rounded text-sm font-semibold transition-all duration-100 cursor-pointer bg-blue-600 text-blue-50 hover:bg-blue-500 flex items-center gap-1.5 whitespace-nowrap"
          >
            <mat-icon class="text-base">add</mat-icon>
            <span>Create Server</span>
          </a>
        </div>
      </div>

      <!-- Main Content Scrollable Viewport -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div class="max-w-[1200px] mx-auto">
          <router-outlet></router-outlet>
        </div>
      </main>

      <!-- Toast Notifications Container -->
      <app-toast-container></app-toast-container>
    </div>
  `,
})
export class MainLayout {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  logout() {
    this.auth.logout();
  }
}
