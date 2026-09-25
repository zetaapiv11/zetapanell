import { Injectable, signal } from '@angular/core';

export interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  priceIdr: number;
  priceUsd: number;
  maxServers: number;
  maxStorageMb: number;
  features: string[];
  recommended?: boolean;
}

export interface AdminWhatsApp {
  number: string;
  display: string;
}

// Public, unauthenticated info shown before login: pricing plans + admin
// contact. Sourced from GET /api/v1/billing/plans, which reads the WhatsApp
// number from the ADMIN_WHATSAPP_NUMBER Render env var (see backend/config.ts)
// so it can be changed without a code deploy.
@Injectable({ providedIn: 'root' })
export class PlatformConfigService {
  readonly plans = signal<PlanTier[]>([]);
  readonly adminWhatsApp = signal<AdminWhatsApp>({
    number: '6285762557515',
    display: '0857-6255-7515',
  });
  readonly loaded = signal(false);

  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.fetchNow();
    }
    return this.loadPromise;
  }

  private async fetchNow() {
    try {
      const res = await fetch('/api/v1/billing/plans');
      const json = await res.json();
      this.plans.set(json.data || []);
      if (json.adminWhatsApp?.number) {
        this.adminWhatsApp.set(json.adminWhatsApp);
      }
    } catch {
      // Keep defaults on failure
    } finally {
      this.loaded.set(true);
    }
  }
}
