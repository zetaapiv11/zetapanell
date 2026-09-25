import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service.js';
import { ToastContainer } from '../../shared/components/toast-container.js';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, ToastContainer],
  template: `
    <div class="min-h-screen bg-neutral-950 text-neutral-100 flex font-sans selection:bg-emerald-500 selection:text-white">
      <!-- Mobile Backdrop Overlay -->
      @if (sidebarOpen()) {
        <button
          type="button"
          aria-label="Close navigation overlay"
          (click)="closeSidebar()"
          (keydown.escape)="closeSidebar()"
          class="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden transition-opacity cursor-default w-full h-full border-none p-0 outline-none"
        ></button>
      }

      <!-- Pterodactyl-Style Persistent / Slide-over Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-50 w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col justify-between transition-transform duration-200 ease-out lg:static lg:translate-x-0 shadow-2xl lg:shadow-none"
        [class.translate-x-0]="sidebarOpen()"
        [class.-translate-x-full]="!sidebarOpen()"
      >
        <!-- Top Section: Brand & Navigation -->
        <div class="flex flex-col flex-1 overflow-y-auto">
          <!-- Brand Logo / Header -->
          <div class="h-16 flex items-center justify-between px-5 border-b border-neutral-800/80 shrink-0">
            <a
              routerLink="/dashboard"
              (click)="closeSidebar()"
              class="flex items-center gap-3 text-base font-bold tracking-tight text-white hover:text-emerald-400 transition-colors"
            >
              <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm shadow-inner">
                Z
              </div>
              <div class="flex flex-col">
                <span class="leading-none">ZetaPanel</span>
                <span class="text-[10px] text-neutral-500 font-mono font-normal tracking-wide mt-1">Render &middot; R2</span>
              </div>
            </a>

            <!-- Mobile Close Button -->
            <button
              type="button"
              (click)="closeSidebar()"
              class="lg:hidden p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <mat-icon class="text-sm">close</mat-icon>
            </button>
          </div>

          <!-- Navigation Links (Categorized Pterodactyl Style) -->
          <div class="p-3 space-y-6 text-xs">
            <!-- Section 1: Core Navigation -->
            <div class="space-y-1">
              <div class="px-3 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-500">
                Core
              </div>
              <a
                routerLink="/dashboard"
                routerLinkActive="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-semibold"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="closeSidebar()"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <mat-icon class="text-lg">dashboard</mat-icon>
                <span>Dashboard</span>
              </a>

              <a
                routerLink="/servers"
                routerLinkActive="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-semibold"
                (click)="closeSidebar()"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <mat-icon class="text-lg">dns</mat-icon>
                <span>Servers</span>
              </a>

              <a
                routerLink="/account"
                routerLinkActive="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-semibold"
                (click)="closeSidebar()"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <mat-icon class="text-lg">person</mat-icon>
                <span>Account</span>
              </a>

              <a
                routerLink="/plans"
                routerLinkActive="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-semibold"
                (click)="closeSidebar()"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <mat-icon class="text-lg text-emerald-400">payments</mat-icon>
                <span>Plans &amp; Pricing</span>
              </a>
            </div>

            <!-- Section 2: Management & Tools -->
            <div class="space-y-1">
              <div class="px-3 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-500">
                Management
              </div>

              <a
                routerLink="/api-keys"
                routerLinkActive="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-semibold"
                (click)="closeSidebar()"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <mat-icon class="text-lg">vpn_key</mat-icon>
                <span>API Keys</span>
              </a>

              <a
                routerLink="/activity"
                routerLinkActive="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-semibold"
                (click)="closeSidebar()"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <mat-icon class="text-lg">history</mat-icon>
                <span>Activity Logs</span>
              </a>

              <a
                routerLink="/docs"
                routerLinkActive="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-semibold"
                (click)="closeSidebar()"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <mat-icon class="text-lg">menu_book</mat-icon>
                <span>Documentation</span>
              </a>
            </div>

            <!-- Section 3: Admin Section (Conditioned on Role) -->
            @if (auth.isAdmin()) {
              <div class="space-y-1">
                <div class="px-3 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-500">
                  Administration
                </div>
                <a
                  routerLink="/admin"
                  routerLinkActive="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-semibold"
                  (click)="closeSidebar()"
                  class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-emerald-300 hover:bg-neutral-800/60 transition-colors cursor-pointer"
                >
                  <mat-icon class="text-lg text-emerald-400">admin_panel_settings</mat-icon>
                  <span>Admin Panel</span>
                </a>
              </div>
            }
          </div>
        </div>

        <!-- Bottom User Card (Pterodactyl Navigation Footer) -->
        <div class="p-3 border-t border-neutral-800/80 bg-neutral-950/60">
          <div class="flex items-center justify-between p-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
            <a
              routerLink="/account"
              (click)="closeSidebar()"
              class="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
            >
              <div class="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-xs uppercase shrink-0 font-mono">
                {{ auth.user()?.username?.charAt(0) || 'U' }}
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold text-white truncate max-w-[100px]">
                  {{ auth.user()?.username }}
                </div>
                <div class="text-[10px] font-mono text-neutral-500 uppercase tracking-wider truncate">
                  {{ auth.user()?.role }}
                </div>
              </div>
            </a>

            <!-- Sign Out Button -->
            <button
              type="button"
              (click)="logout()"
              title="Sign Out"
              class="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <mat-icon class="text-base">logout</mat-icon>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Layout Body (Right of Sidebar) -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Top Context Header Bar -->
        <header class="h-16 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <!-- Mobile Menu Toggle -->
            <button
              type="button"
              (click)="toggleSidebar()"
              class="lg:hidden p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Open Navigation Menu"
            >
              <mat-icon class="text-xl">menu</mat-icon>
            </button>

            <!-- Current Workspace Indicator -->
            <div class="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-neutral-300 font-semibold hidden sm:inline">Render Cloud:</span>
              <span class="text-neutral-400">Active</span>
            </div>
          </div>

          <!-- Header Actions -->
          <div class="flex items-center gap-3">
            <a
              routerLink="/servers/new"
              class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <mat-icon class="text-sm">add</mat-icon>
              <span>Create Server</span>
            </a>
          </div>
        </header>

        <!-- Main Content Scrollable Viewport -->
        <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div class="max-w-7xl mx-auto">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>

      <!-- Toast Notifications Container -->
      <app-toast-container></app-toast-container>
    </div>
  `,
})
export class MainLayout {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  sidebarOpen = signal(false);

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }

  logout() {
    this.closeSidebar();
    this.auth.logout();
  }
}
