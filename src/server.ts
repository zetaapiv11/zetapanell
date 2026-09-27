import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { apiRouter } from './backend/api.js';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/**
 * Angular's SSR engine validates the incoming request's Host header against
 * an allow-list (an SSRF protection added in recent Angular versions) and,
 * on a mismatch, silently falls back to client-side rendering -- which on
 * this app currently means a blank page, since nothing else renders a
 * fallback shell. Render's proxy presents whatever public hostname the
 * visitor used (the default *.onrender.com URL, and/or any custom domain),
 * so every hostname this app can be reached at needs to be listed here.
 *
 * Picked up automatically:
 *   - RENDER_EXTERNAL_URL -- Render's own auto-injected URL for this service
 *   - APP_URL             -- set if you're using a custom domain
 * Anything else (extra custom domains, preview URLs, etc.) can be added
 * without a code change via the NG_ALLOWED_HOSTS env var (comma-separated
 * hostnames, no protocol -- e.g. "panel.example.com,panel2.example.com").
 */
function getAllowedHosts(): string[] {
  const hosts = new Set<string>(['localhost']);

  const fromEnv = process.env['NG_ALLOWED_HOSTS'];
  if (fromEnv) {
    fromEnv
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
      .forEach((h) => hosts.add(h));
  }

  for (const url of [process.env['APP_URL'], process.env['RENDER_EXTERNAL_URL']]) {
    if (!url) continue;
    try {
      hosts.add(new URL(url).hostname);
    } catch {
      // Ignore malformed URLs in env vars rather than crashing startup
    }
  }

  return Array.from(hosts);
}

const angularApp = new AngularNodeAppEngine({
  allowedHosts: getAllowedHosts(),
  // Render's own proxy sits in front of every service, so its X-Forwarded-*
  // headers (client IP, original host/proto) are trustworthy here.
  trustProxyHeaders: true,
});

// CORS & security headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// REST API Endpoints
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`ZetaPanel Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
