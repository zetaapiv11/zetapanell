import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- Sidebar Navigation -->
      <aside class="lg:col-span-1 space-y-1 text-xs font-medium sticky top-20 h-fit">
        <div class="text-[11px] font-mono font-semibold uppercase text-neutral-500 mb-2 px-3">
          Documentation
        </div>
        <button
          type="button"
          (click)="activeSection.set('getting-started')"
          class="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
          [class.bg-neutral-800]="activeSection() === 'getting-started'"
          [class.text-emerald-400]="activeSection() === 'getting-started'"
          [class.text-neutral-400]="activeSection() !== 'getting-started'"
        >
          Getting Started
        </button>
        <button
          type="button"
          (click)="activeSection.set('discord-bot')"
          class="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
          [class.bg-neutral-800]="activeSection() === 'discord-bot'"
          [class.text-emerald-400]="activeSection() === 'discord-bot'"
          [class.text-neutral-400]="activeSection() !== 'discord-bot'"
        >
          Discord Bot Deployment
        </button>
        <button
          type="button"
          (click)="activeSection.set('r2-storage')"
          class="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
          [class.bg-neutral-800]="activeSection() === 'r2-storage'"
          [class.text-emerald-400]="activeSection() === 'r2-storage'"
          [class.text-neutral-400]="activeSection() !== 'r2-storage'"
        >
          Cloudflare R2 File Manager
        </button>
        <button
          type="button"
          (click)="activeSection.set('render-engine')"
          class="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
          [class.bg-neutral-800]="activeSection() === 'render-engine'"
          [class.text-emerald-400]="activeSection() === 'render-engine'"
          [class.text-neutral-400]="activeSection() !== 'render-engine'"
        >
          Render API Infrastructure
        </button>
        <button
          type="button"
          (click)="activeSection.set('api-reference')"
          class="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
          [class.bg-neutral-800]="activeSection() === 'api-reference'"
          [class.text-emerald-400]="activeSection() === 'api-reference'"
          [class.text-neutral-400]="activeSection() !== 'api-reference'"
        >
          REST API &amp; Code Examples
        </button>
        <button
          type="button"
          (click)="activeSection.set('rate-limits')"
          class="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
          [class.bg-neutral-800]="activeSection() === 'rate-limits'"
          [class.text-emerald-400]="activeSection() === 'rate-limits'"
          [class.text-neutral-400]="activeSection() !== 'rate-limits'"
        >
          Errors &amp; Rate Limits
        </button>

        <div class="pt-4 px-3">
          <a
            href="/api/v1/docs/openapi.json"
            target="_blank"
            class="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>OpenAPI 3.0 Spec</span>
            <mat-icon class="text-xs">open_in_new</mat-icon>
          </a>
        </div>
      </aside>

      <!-- Main Docs Content Area -->
      <main class="lg:col-span-3 space-y-8 text-neutral-300 text-xs leading-relaxed font-sans">
        @switch (activeSection()) {
          @case ('getting-started') {
            <div class="space-y-4">
              <h1 class="text-xl font-bold text-white tracking-tight">Getting Started with ZetaPanel</h1>
              <p>
                ZetaPanel is a high-performance infrastructure control panel inspired by Pterodactyl's sleek developer UX, engineered to manage live services on <strong>Render API</strong> while storing all files and ZIP archives directly in <strong>Cloudflare R2</strong>.
              </p>

              <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-2">
                <h3 class="font-semibold text-white text-xs">Core Principles</h3>
                <ul class="list-disc list-inside space-y-1 text-neutral-400">
                  <li><strong>Zero Mock Data:</strong> Every server restart, deployment, and log stream communicates with Render API v1.</li>
                  <li><strong>True S3 Storage:</strong> File uploads, folder structures, and ZIP archives are stored directly in Cloudflare R2 bucket keys.</li>
                  <li><strong>Automated Git Bridge:</strong> When using ZetaPanel managed storage, the internal Git HTTP engine bridges files from R2 directly into Render's deployment pipeline.</li>
                </ul>
              </div>

              <h2 class="text-base font-semibold text-white pt-2">How to Create Your First Server</h2>
              <ol class="list-decimal list-inside space-y-2 text-neutral-300">
                <li>Navigate to <a routerLink="/servers/new" class="text-emerald-400 hover:underline">Create Server</a>.</li>
                <li>Enter a server name (e.g. <code class="font-mono text-white bg-neutral-900 px-1.5 py-0.5 rounded">my-bot</code>).</li>
                <li>Select your service type: <strong>Background Worker</strong> (ideal for Discord bots &amp; queue daemons) or <strong>Web Service</strong> (for HTTP APIs).</li>
                <li>Choose between <strong>ZetaPanel Managed Storage (R2)</strong> or connect your external Git repo URL.</li>
                <li>Click <strong>Deploy Service</strong>. ZetaPanel registers the service on Render, commits the initial template, and opens your server console.</li>
              </ol>
            </div>
          }

          @case ('discord-bot') {
            <div class="space-y-4">
              <h1 class="text-xl font-bold text-white tracking-tight">Running Discord Bots on ZetaPanel</h1>
              <p>
                ZetaPanel provides first-class support for Discord bots (Node.js discord.js, Python discord.py, etc.) using Render <strong>Background Worker</strong> services.
              </p>

              <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-3 font-mono">
                <div class="text-emerald-400 font-semibold">1. Recommended Worker Settings</div>
                <div class="text-neutral-300 text-[11px] space-y-1">
                  <div>Service Type: <span class="text-white">background_worker</span></div>
                  <div>Runtime: <span class="text-white">node</span> (or python)</div>
                  <div>Build Command: <span class="text-white">npm install</span></div>
                  <div>Start Command: <span class="text-white">npm start</span> (or node index.js)</div>
                </div>
              </div>

              <div class="space-y-2">
                <h3 class="font-semibold text-white text-xs">2. Configuring Bot Tokens</h3>
                <p>
                  In the <strong>Environment</strong> tab of your server, add your Discord bot token:
                </p>
                <div class="bg-neutral-950 p-3 rounded-xl border border-neutral-800 font-mono text-xs text-neutral-300">
                  <div>DISCORD_TOKEN = <span class="text-neutral-500">MTA5...your_token_here</span></div>
                  <div>PREFIX = !</div>
                </div>
              </div>

              <div class="space-y-2">
                <h3 class="font-semibold text-white text-xs">3. Verifying Logs in the Console</h3>
                <p>
                  Once deployed, open the <strong>Console</strong> tab to view live Render worker output:
                </p>
                <div class="bg-neutral-950 p-3 rounded-xl border border-neutral-800 font-mono text-xs text-emerald-400 space-y-1">
                  <div>[RENDER] Service 'my-discord-bot' registered</div>
                  <div>[BUILD] npm install completed</div>
                  <div>[RUNTIME] Logged in as ZetaBot#1234!</div>
                  <div>[RUNTIME] Ready and listening for commands.</div>
                </div>
              </div>
            </div>
          }

          @case ('r2-storage') {
            <div class="space-y-4">
              <h1 class="text-xl font-bold text-white tracking-tight">Cloudflare R2 File Architecture</h1>
              <p>
                All server files are stored using Cloudflare R2's S3-compatible object storage.
              </p>

              <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 font-mono text-xs space-y-2">
                <div class="text-neutral-400">Object Key Path Scheme:</div>
                <div class="text-emerald-400">users/&#123;userId&#125;/servers/&#123;serverId&#125;/files/&#123;filePath&#125;</div>
              </div>

              <h3 class="font-semibold text-white text-xs">File Manager Features</h3>
              <ul class="list-disc list-inside space-y-1 text-neutral-400">
                <li><strong>Direct Upload &amp; Extract:</strong> Uploading a <code class="text-white">.zip</code> automatically extracts entries directly into the server's R2 key prefix.</li>
                <li><strong>Inline Code Editing:</strong> Edit JS, TS, JSON, ENV, and configuration files directly in browser and persist atomically to R2.</li>
                <li><strong>Sync &amp; Deploy:</strong> Synchronizes R2 storage contents into the internal Git Bridge and triggers a fresh deploy on Render.</li>
              </ul>
            </div>
          }

          @case ('render-engine') {
            <div class="space-y-4">
              <h1 class="text-xl font-bold text-white tracking-tight">Render API Infrastructure Client</h1>
              <p>
                ZetaPanel communicates with the official Render API (<code class="font-mono text-emerald-400">https://api.render.com/v1</code>).
              </p>

              <div class="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-2">
                <h3 class="font-semibold text-white text-xs">Supported Render Resources</h3>
                <ul class="list-disc list-inside space-y-1 text-neutral-400">
                  <li><code class="text-white">POST /v1/services</code>: Provisions web services, background workers, cron jobs.</li>
                  <li><code class="text-white">POST /v1/services/:id/deploys</code>: Initiates build pipelines (supports cache clearing).</li>
                  <li><code class="text-white">POST /v1/services/:id/restart</code>: Restarts daemon containers.</li>
                  <li><code class="text-white">PUT /v1/services/:id/env-vars</code>: Updates encrypted environment variables.</li>
                  <li><code class="text-white">POST /v1/services/:id/suspend</code> &amp; <code class="text-white">/resume</code>: Lifecycle suspension controls.</li>
                </ul>
              </div>
            </div>
          }

          @case ('api-reference') {
            <div class="space-y-4">
              <h1 class="text-xl font-bold text-white tracking-tight">REST API Reference &amp; Examples</h1>
              <p>
                Authenticate requests using your ZetaPanel API key via the <code class="font-mono text-white">Authorization: Bearer zp_live_...</code> header.
              </p>

              <div class="space-y-3">
                <h3 class="font-semibold text-white text-xs">Example 1: List Servers (cURL)</h3>
                <pre class="p-3 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">curl -X GET {{ panelUrl }}/api/v1/servers &#92;
  -H "Authorization: Bearer zp_live_your_key_here"</pre>
              </div>

              <div class="space-y-3">
                <h3 class="font-semibold text-white text-xs">Example 2: Trigger Deployment (JavaScript Fetch)</h3>
                <pre class="p-3 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-[11px] text-neutral-300 overflow-x-auto">const res = await fetch('{{ panelUrl }}/api/v1/servers/srv_12345/deploy', &#123;
  method: 'POST',
  headers: &#123;
    'Authorization': 'Bearer zp_live_your_key_here',
    'Content-Type': 'application/json'
  &#125;,
  body: JSON.stringify(&#123; clearCache: false &#125;)
&#125;);
const data = await res.json();
console.log('Deploy Status:', data.data.status);</pre>
              </div>

              <div class="space-y-3">
                <h3 class="font-semibold text-white text-xs">Example 3: Node.js Client</h3>
                <pre class="p-3 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-[11px] text-neutral-300 overflow-x-auto">const https = require('https');

const req = https.request('{{ panelUrl }}/api/v1/servers/srv_12345/status', &#123;
  headers: &#123; 'Authorization': 'Bearer zp_live_your_key_here' &#125;
&#125;, (res) => &#123;
  res.on('data', d => process.stdout.write(d));
&#125;);
req.end();</pre>
              </div>
            </div>
          }

          @case ('rate-limits') {
            <div class="space-y-4">
              <h1 class="text-xl font-bold text-white tracking-tight">Errors &amp; Rate Limits</h1>
              <p>
                To maintain infrastructure security and prevent runaway Render charges, ZetaPanel enforces rate limits:
              </p>

              <div class="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden font-mono text-xs">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="border-b border-neutral-800 bg-neutral-950 text-neutral-400">
                      <th class="p-3 font-sans">Endpoint Group</th>
                      <th class="p-3">Limit</th>
                      <th class="p-3 font-sans">Window</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-800 text-neutral-300">
                    <tr>
                      <td class="p-3 font-sans">Deployments &amp; Restarts</td>
                      <td class="p-3">10 requests</td>
                      <td class="p-3">1 minute</td>
                    </tr>
                    <tr>
                      <td class="p-3 font-sans">Authentication</td>
                      <td class="p-3">15 attempts</td>
                      <td class="p-3">1 minute</td>
                    </tr>
                    <tr>
                      <td class="p-3 font-sans">General REST API</td>
                      <td class="p-3">200 requests</td>
                      <td class="p-3">1 minute</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          }
        }
      </main>
    </div>
  `,
})
export class Docs {
  activeSection = signal<string>('getting-started');
  panelUrl = typeof window !== 'undefined' ? window.location.origin : 'https://panel.example.com';
}
