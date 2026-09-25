import { join } from 'node:path';

// Helper to safely read env
export const config = {
  port: Number(process.env['PORT']) || 3000,
  jwtSecret: process.env['JWT_SECRET'] || 'zetapanel-super-secure-jwt-secret-key-2026',
  jwtExpiresIn: '7d',
  
  // Render API configuration
  renderApiKey: process.env['RENDER_API_KEY'] || '',
  renderBaseUrl: 'https://api.render.com/v1',
  renderOwnerId: process.env['RENDER_OWNER_ID'] || '',
  databaseUrl: process.env['DATABASE_URL'] || '',
  
  // Cloudflare R2 / S3 configuration
  r2AccountId: process.env['R2_ACCOUNT_ID'] || '',
  r2AccessKeyId: process.env['R2_ACCESS_KEY_ID'] || '',
  r2SecretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] || '',
  r2Bucket: process.env['R2_BUCKET'] || 'zetapanel-servers',
  r2PublicUrl: process.env['R2_PUBLIC_URL'] || '',

  // GitHub configuration — Git Bridge pushes each server's files to a real
  // GitHub repo here (Render no longer accepts self-hosted git remotes as a
  // service's `repo`; only github.com/gitlab.com/bitbucket.org/cursor.com
  // are accepted). Needs a Personal Access Token with the 'repo' scope.
  // IMPORTANT: the Render account itself must ALSO have GitHub connected
  // under Account Settings > Git Deployment Credentials (one-time, manual —
  // there's no API for it), or Render will refuse to clone repos under this
  // owner even though the token above can create/push to them fine.
  githubToken: process.env['GITHUB_TOKEN'] || '',
  // Username or org that repos get created under. Defaults to the token's
  // own account (resolved at runtime via GET /user) if left blank.
  githubOwner: process.env['GITHUB_OWNER'] || '',
  // 'user' if githubOwner is a personal account, 'org' if it's an organization.
  githubOwnerType: (process.env['GITHUB_OWNER_TYPE'] || 'user') as 'user' | 'org',
  // 'private' (default) or 'public'.
  githubVisibility: (process.env['GITHUB_REPO_VISIBILITY'] || 'private') as 'private' | 'public',
  
  // App URL for Git bridge and webhooks.
  // Priority: explicit APP_URL (e.g. a custom domain) > Render's own
  // auto-injected RENDER_EXTERNAL_URL (https://<service>.onrender.com,
  // set automatically for every Render web service, no config needed) >
  // localhost fallback for local dev.
  appUrl: process.env['APP_URL'] || process.env['RENDER_EXTERNAL_URL'] || 'http://localhost:3000',

  // Sales/contact info shown on the public pricing page & quota-limit messages.
  // Set these as Render env vars so the panel owner can change them without a
  // code change/redeploy.
  adminWhatsApp: process.env['ADMIN_WHATSAPP_NUMBER'] || '6285762557515', // digits only, country code first (no +)

  // Storage paths. On Render, mount a persistent Disk and set DATA_DIR to its
  // mount path (e.g. /data) -- otherwise the JSON "database" and git-bridge
  // repos live on the container's ephemeral disk and are wiped on every deploy.
  dataDir: process.env['DATA_DIR'] || join(process.cwd(), '.data'),
  reposDir: join(process.env['DATA_DIR'] || join(process.cwd(), '.data'), 'repos'),
  uploadsDir: join(process.env['DATA_DIR'] || join(process.cwd(), '.data'), 'uploads'),
};

// "6285762557515" -> "0857-6255-7515" (Indonesian local display format).
// Falls back to the raw value if it doesn't look like a 62-prefixed number.
export function formatAdminWhatsApp(raw: string = config.adminWhatsApp): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits.startsWith('62') || digits.length < 10) return raw;
  const local = '0' + digits.slice(2);
  return local.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
}
