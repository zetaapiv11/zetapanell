import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard.js';
import { authGuard } from './core/guards/auth.guard.js';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login.js').then((m) => m.Login),
  },
  {
    path: 'pricing',
    loadComponent: () =>
      import('./pages/pricing-public/pricing-public.js').then((m) => m.PricingPublic),
  },
  {
    path: '',
    loadComponent: () => import('./pages/layout/main-layout.js').then((m) => m.MainLayout),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.js').then((m) => m.Dashboard),
      },
      {
        path: 'servers',
        loadComponent: () => import('./pages/servers/server-list.js').then((m) => m.ServerList),
      },
      {
        path: 'servers/new',
        loadComponent: () => import('./pages/servers/server-create.js').then((m) => m.ServerCreate),
      },
      {
        path: 'servers/:id',
        loadComponent: () =>
          import('./pages/servers/server-detail/server-layout.js').then((m) => m.ServerLayout),
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'console',
          },
          {
            path: 'console',
            loadComponent: () =>
              import('./pages/servers/server-detail/server-console.js').then((m) => m.ServerConsole),
          },
          {
            path: 'files',
            loadComponent: () =>
              import('./pages/servers/server-detail/server-files.js').then((m) => m.ServerFiles),
          },
          {
            path: 'startup',
            loadComponent: () =>
              import('./pages/servers/server-detail/server-startup.js').then((m) => m.ServerStartup),
          },
          {
            path: 'env',
            loadComponent: () =>
              import('./pages/servers/server-detail/server-env.js').then((m) => m.ServerEnv),
          },
          {
            path: 'deployments',
            loadComponent: () =>
              import('./pages/servers/server-detail/server-deployments.js').then(
                (m) => m.ServerDeployments
              ),
          },
          {
            path: 'activity',
            loadComponent: () =>
              import('./pages/servers/server-detail/server-activity.js').then(
                (m) => m.ServerActivity
              ),
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('./pages/servers/server-detail/server-settings.js').then(
                (m) => m.ServerSettings
              ),
          },
        ],
      },
      {
        path: 'account',
        loadComponent: () => import('./pages/account/account.js').then((m) => m.Account),
      },
      {
        path: 'plans',
        loadComponent: () => import('./pages/plans/plans.js').then((m) => m.Plans),
      },
      {
        path: 'api-keys',
        loadComponent: () => import('./pages/api-keys/api-keys.js').then((m) => m.ApiKeys),
      },
      {
        path: 'activity',
        loadComponent: () => import('./pages/activity/activity.js').then((m) => m.Activity),
      },
      {
        path: 'docs',
        loadComponent: () => import('./pages/docs/docs.js').then((m) => m.Docs),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/admin/admin.js').then((m) => m.Admin),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
