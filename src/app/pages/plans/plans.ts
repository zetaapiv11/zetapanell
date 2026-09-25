import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service.js';
import { PlanTier, PlatformConfigService } from '../../core/services/platform-config.service.js';

@Component({
  selector: 'app-plans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="space-y-8 max-w-6xl mx-auto font-sans">
      <!-- Header -->
      <div class="text-center max-w-2xl mx-auto space-y-2">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 font-mono text-[11px] font-semibold">
          <mat-icon class="text-xs">bolt</mat-icon>
          <span>Render &amp; Cloudflare R2 Infrastructure Plans</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Transparent Hosting Plans
        </h1>
        <p class="text-xs text-neutral-400 leading-relaxed">
          ZetaPanel uses dedicated production infrastructure. Standard accounts require an active subscription to provision live servers on Render with Cloudflare R2 storage.
        </p>
      </div>

      <!-- Direct WhatsApp Admin Banner (0857-6255-7515) -->
      <div class="p-4 sm:p-5 rounded-2xl border border-emerald-800/80 bg-gradient-to-r from-emerald-950/60 to-neutral-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <mat-icon class="text-2xl">chat</mat-icon>
          </div>
          <div>
            <div class="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
              <span>Upgrade Manual via WhatsApp Admin</span>
              <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-semibold border border-emerald-500/30">
                +62 {{ platformConfig.adminWhatsApp().display }}
              </span>
            </div>
            <p class="text-xs text-neutral-300 mt-0.5">
              Hubungi Admin langsung untuk konfirmasi transfer, invoice, atau aktivasi paket manual tanpa antre.
            </p>
          </div>
        </div>

        <a
          [href]="getGeneralWhatsAppUrl()"
          target="_blank"
          rel="noopener noreferrer"
          class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md shrink-0 cursor-pointer"
        >
          <mat-icon class="text-sm">open_in_new</mat-icon>
          <span>Chat WA Admin</span>
        </a>
      </div>

      <!-- Currency Switcher Banner -->
      <div class="flex items-center justify-center gap-3 text-xs font-mono">
        <button
          type="button"
          (click)="currency.set('IDR')"
          class="px-3 py-1 rounded-lg border transition-colors cursor-pointer"
          [class.bg-emerald-950]="currency() === 'IDR'"
          [class.border-emerald-700]="currency() === 'IDR'"
          [class.text-emerald-300]="currency() === 'IDR'"
          [class.border-neutral-800]="currency() !== 'IDR'"
          [class.text-neutral-400]="currency() !== 'IDR'"
        >
          Rupiah (IDR)
        </button>
        <button
          type="button"
          (click)="currency.set('USD')"
          class="px-3 py-1 rounded-lg border transition-colors cursor-pointer"
          [class.bg-emerald-950]="currency() === 'USD'"
          [class.border-emerald-700]="currency() === 'USD'"
          [class.text-emerald-300]="currency() === 'USD'"
          [class.border-neutral-800]="currency() !== 'USD'"
          [class.text-neutral-400]="currency() !== 'USD'"
        >
          USD ($)
        </button>
      </div>

      <!-- Plans Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        @for (plan of plans(); track plan.id) {
          <div
            class="relative rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200"
            [class.border-emerald-500]="plan.recommended"
            [class.bg-gradient-to-b]="plan.recommended"
            [class.from-neutral-900]="plan.recommended"
            [class.to-emerald-950/20]="plan.recommended"
            [class.border-neutral-800]="!plan.recommended"
            [class.bg-neutral-900/50]="!plan.recommended"
          >
            @if (plan.recommended) {
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-mono text-[10px] font-bold uppercase tracking-wider shadow">
                Most Popular
              </div>
            }

            <div class="space-y-4">
              <div>
                <h3 class="text-base font-bold text-white tracking-tight">{{ plan.name }}</h3>
                <p class="text-[11px] text-neutral-400 mt-1 min-h-[32px] leading-tight">
                  {{ plan.tagline }}
                </p>
              </div>

              <!-- Price -->
              <div class="pt-2 border-t border-neutral-800">
                <div class="flex items-baseline gap-1">
                  @if (currency() === 'IDR') {
                    <span class="text-xs text-neutral-400">Rp</span>
                    <span class="text-2xl font-bold font-mono text-white tracking-tight">
                      {{ plan.priceIdr.toLocaleString('id-ID') }}
                    </span>
                    <span class="text-[10px] text-neutral-500 font-mono">/ bln</span>
                  } @else {
                    <span class="text-xs text-neutral-400">$</span>
                    <span class="text-2xl font-bold font-mono text-white tracking-tight">
                      {{ plan.priceUsd.toFixed(2) }}
                    </span>
                    <span class="text-[10px] text-neutral-500 font-mono">/ mo</span>
                  }
                </div>
                <div class="text-[10px] text-neutral-500 font-mono mt-0.5">
                  Quota: {{ plan.maxServers }} Server{{ plan.maxServers > 1 ? 's' : '' }} &middot; {{ plan.maxStorageMb / 1024 }} GB R2
                </div>
              </div>

              <!-- Features -->
              <ul class="space-y-2 text-xs text-neutral-300 pt-2 border-t border-neutral-800/80">
                @for (feat of plan.features; track feat) {
                  <li class="flex items-start gap-2 text-[11px]">
                    <mat-icon class="text-emerald-400 text-sm shrink-0 mt-0.5">check_circle</mat-icon>
                    <span class="leading-tight">{{ feat }}</span>
                  </li>
                }
              </ul>
            </div>

            <!-- Subscribe Actions -->
            <div class="pt-6">
              <button
                type="button"
                (click)="openWhatsAppUpgrade(plan)"
                class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Chat Admin on WhatsApp for manual verification and upgrade"
              >
                <mat-icon class="text-sm">chat</mat-icon>
                <span>Upgrade via WA Admin</span>
              </button>
            </div>
          </div>
        }
      </div>

      <!-- FAQ & Payment Information -->
      <div class="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-4">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <mat-icon class="text-emerald-400 text-base">payment</mat-icon>
          <span>Payment &amp; Activation Workflow</span>
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-400 leading-relaxed font-sans">
          <div>
            <span class="font-semibold text-neutral-200 block mb-1">1. Pilih Paket &amp; Chat WA</span>
            Klik tombol <strong>Upgrade via WA Admin</strong> pada paket yang dipilih untuk mengirim detail username Anda ke WhatsApp Admin.
          </div>
          <div>
            <span class="font-semibold text-neutral-200 block mb-1">2. Pembayaran (QRIS / Transfer)</span>
            Lakukan pembayaran melalui QRIS, Bank Transfer, atau E-Wallet sesuai instruksi Admin.
          </div>
          <div>
            <span class="font-semibold text-neutral-200 block mb-1">3. Admin Mengaktifkan Akun</span>
            Admin memverifikasi dan langsung menaikkan kuota server &amp; storage Anda di Admin Panel agar Anda dapat mulai membuat server.
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Plans implements OnInit {
  readonly auth = inject(AuthService);
  readonly platformConfig = inject(PlatformConfigService);

  currency = signal<'IDR' | 'USD'>('IDR');
  plans = this.platformConfig.plans;

  getGeneralWhatsAppUrl(): string {
    const user = this.auth.user();
    const wa = this.platformConfig.adminWhatsApp();
    const text = `Halo Admin ZetaPanel (+62 ${wa.display}), saya ingin konsultasi atau upgrade paket hosting untuk akun saya:
- Username: ${user?.username || 'user'}
- Email: ${user?.email || '-'}
Mohon info aktivasi manual. Terima kasih!`;
    return `https://wa.me/${wa.number}?text=${encodeURIComponent(text)}`;
  }

  openWhatsAppUpgrade(plan: PlanTier) {
    const user = this.auth.user();
    const wa = this.platformConfig.adminWhatsApp();
    const priceText = this.currency() === 'IDR'
      ? `Rp ${plan.priceIdr.toLocaleString('id-ID')}/bln`
      : `$${plan.priceUsd.toFixed(2)}/mo`;

    const text = `Halo Admin ZetaPanel (+62 ${wa.display}), saya ingin upgrade paket hosting untuk akun saya:
- Username: ${user?.username || 'user'}
- Email: ${user?.email || '-'}
- Paket yang dipilih: ${plan.name} (${priceText})
- Kuota: ${plan.maxServers} Server(s) & ${plan.maxStorageMb / 1024} GB Cloudflare R2

Mohon dibantu proses upgrade dan aktivasi manualnya. Terima kasih!`;

    const url = `https://wa.me/${wa.number}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  ngOnInit() {
    this.platformConfig.load();
  }
}

