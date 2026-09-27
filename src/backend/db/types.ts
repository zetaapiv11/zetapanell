export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  maxServers: number;
  maxStorageMb: number;
  plan?: string;
  createdAt: string;
  updatedAt: string;
}

export type ServerRuntime = 'node' | 'python' | 'docker' | 'go' | 'ruby' | 'elixir';
export type ServiceType = 'web_service' | 'background_worker' | 'private_service' | 'cron_job';
export type ServerStatus = 'CREATING' | 'BUILDING' | 'DEPLOYING' | 'ONLINE' | 'FAILED' | 'SUSPENDED' | 'DELETED' | 'UNKNOWN';

export interface ServerEnvVar {
  key: string;
  value: string;
}

export interface ServerRecord {
  id: string;
  userId: string;
  renderServiceId: string;
  name: string;
  description?: string;
  runtime: ServerRuntime;
  serviceType: ServiceType;
  region: string;
  plan: string;
  repoType: 'git' | 'r2_managed';
  repoUrl: string;
  // Set only for repoType 'r2_managed' — the real GitHub repo ("owner/name")
  // that Git Bridge pushes R2 file syncs into, since Render's `repo` field
  // only accepts github.com/gitlab.com/bitbucket.org/cursor.com URLs.
  githubRepoFullName?: string;
  branch: string;
  buildCommand: string;
  startCommand: string;
  preDeployCommand?: string;
  healthCheckPath?: string;
  autoDeploy: boolean;
  status: ServerStatus;
  rawRenderStatus?: string;
  dashboardUrl?: string;
  serviceUrl?: string;
  envVars: ServerEnvVar[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  permissions: string[];
  lastUsedAt?: string;
  createdAt: string;
}

export interface ActivityLogRecord {
  id: string;
  userId: string;
  username: string;
  serverId?: string;
  serverName?: string;
  action: string;
  details: string;
  ip?: string;
  timestamp: string;
}

export interface SystemSettings {
  panelName: string;
  panelLogo?: string;
  panelUrl: string;
  allowRegistration: boolean;
  maintenanceMode: boolean;
  defaultRegion: string;
  defaultRuntime: ServerRuntime;
  defaultPlan: string;
  maxServersPerUser: number;
  maxStorageMbPerUser: number;
  maxUploadSizeBytes: number;
  renderApiKey: string;
  renderOwnerId: string;
  renderOwnerName: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  githubToken: string;
  githubOwner: string;
  githubOwnerType: 'user' | 'org';
  githubVisibility: 'private' | 'public';
}
