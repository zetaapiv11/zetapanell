export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  username: string;
  email: string;
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

export interface ServerItem {
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

export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt?: string;
  createdAt: string;
}

export interface ActivityLogItem {
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

export interface RenderDeployItem {
  id: string;
  status: string;
  trigger?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  commit?: {
    id: string;
    message: string;
    createdAt: string;
  };
}

export interface AdminOverview {
  usersCount: number;
  serversCount: number;
  serversBreakdown: {
    online: number;
    deploying: number;
    failed: number;
    suspended: number;
  };
  infrastructure: {
    renderConnected: boolean;
    renderWorkspacesCount: number;
    renderError: string | null;
    activeWorkspace: string;
    r2Configured: boolean;
    r2Bucket: string;
  };
  settings: {
    panelName: string;
    allowRegistration: boolean;
    maintenanceMode: boolean;
  };
}
