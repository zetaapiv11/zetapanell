import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service.js';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Check if token exists in storage before kicking out
  if (typeof window !== 'undefined' && localStorage.getItem('zp_token')) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
