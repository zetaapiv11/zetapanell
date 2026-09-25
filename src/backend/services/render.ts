import { db } from '../db/index.js';
import { ServerStatus, ServiceType } from '../db/types.js';

export interface RenderOwner {
  id: string;
  name: string;
  email: string;
  type: 'user' | 'team';
}

export interface RenderServiceDetail {
  id: string;
  name: string;
  type: ServiceType;
  repo: string;
  branch: string;
  autoDeploy: 'yes' | 'no';
  serviceDetails: {
    env: string;
    plan: string;
    region: string;
    buildCommand?: string;
    startCommand?: string;
    preDeployCommand?: string;
    healthCheckPath?: string;
    url?: string;
    envVars?: Array<{ key: string; value: string }>;
  };
  suspended?: 'suspended' | 'not_suspended';
  updatedAt: string;
  createdAt: string;
  dashboardUrl?: string;
}

export interface RenderDeploy {
  id: string;
  commit?: {
    id: string;
    message: string;
    createdAt: string;
  };
  status:
    | 'created'
    | 'build_in_progress'
    | 'update_in_progress'
    | 'live'
    | 'deactivated'
    | 'build_failed'
    | 'update_failed'
    | 'canceled';
  trigger?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export class RenderApiClient {
  private baseUrl = 'https://api.render.com/v1';

  private getApiKey(overrideKey?: string): string {
    if (overrideKey && overrideKey.trim()) {
      return overrideKey.trim();
    }

    const settings = db.getSettings();
    const key = settings.renderApiKey || process.env['RENDER_API_KEY'] || '';

    if (!key) {
      throw new Error(
        'Render API Key is not configured. Please set RENDER_API_KEY in environment or via Admin Settings.'
      );
    }

    return key.trim();
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
      body?: any;
      apiKey?: string;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      apiKey,
      timeoutMs = 25000,
    } = options;

    const token = this.getApiKey(apiKey);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'ZetaPanel/1.0.0',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Status 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      const contentType =
        response.headers.get('content-type') || '';

      const isJson = contentType.includes('application/json');

      const responseData = isJson
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const errorMsg =
          (isJson &&
            (
              responseData.message ||
              responseData.error ||
              responseData.errors?.[0]?.message
            )) ||
          `Render API HTTP ${response.status}: ${response.statusText}`;

        console.error(
          `[Render API Error] ${method} ${endpoint} -> ${response.status}:`,
          responseData
        );

        throw new Error(errorMsg);
      }

      return responseData as T;
    } catch (err: any) {
      clearTimeout(timeout);

      if (err.name === 'AbortError') {
        throw new Error(
          `Render API request timed out after ${timeoutMs}ms`
        );
      }

      throw err;
    }
  }

  // --- Workspaces / Owners ---

  async listOwners(apiKey?: string): Promise<RenderOwner[]> {
    const res = await this.request<any[]>('/owners', {
      apiKey,
    });

    // Render returns:
    // [
    //   {
    //     cursor: string,
    //     owner: {
    //       id,
    //       name,
    //       email,
    //       type
    //     }
    //   }
    // ]

    if (Array.isArray(res)) {
      return res.map((item) => {
        return item.owner ? item.owner : item;
      });
    }

    return [];
  }

  async testConnection(apiKey?: string): Promise<{
    connected: boolean;
    owners: RenderOwner[];
    activeOwner?: RenderOwner;
  }> {
    const owners = await this.listOwners(apiKey);

    if (!owners.length) {
      throw new Error(
        'Connection succeeded but no workspaces/owners found for this Render API key.'
      );
    }

    return {
      connected: true,
      owners,
      activeOwner: owners[0],
    };
  }

  // --- Services ---

  async listServices(limit = 50): Promise<any[]> {
    const res = await this.request<any[]>(
      `/services?limit=${limit}`
    );

    if (Array.isArray(res)) {
      return res.map((item) => {
        return item.service ? item.service : item;
      });
    }

    return [];
  }

  async getService(
    serviceId: string
  ): Promise<RenderServiceDetail> {
    const res = await this.request<any>(
      `/services/${serviceId}`
    );

    return res.service || res;
  }

  async createService(params: {
    type: ServiceType;
    name: string;
    ownerId?: string;
    repo: string;
    branch?: string;
    autoDeploy?: boolean;
    env: string;
    plan?: string;
    region?: string;
    buildCommand?: string;
    startCommand?: string;
    preDeployCommand?: string;
    healthCheckPath?: string;
    envVars?: Array<{
      key: string;
      value: string;
    }>;
  }): Promise<RenderServiceDetail> {
    let ownerId = params.ownerId;

    if (!ownerId) {
      const settings = db.getSettings();
      ownerId = settings.renderOwnerId;
    }

    if (!ownerId) {
      const owners = await this.listOwners();

      if (!owners.length) {
        throw new Error(
          'No Render workspace/owner found. Cannot create service.'
        );
      }

      ownerId = owners[0].id;

      db.updateSettings({
        renderOwnerId: ownerId,
        renderOwnerName:
          owners[0].name || owners[0].email,
      });
    }

    const serviceDetails: any = {
      env: params.env || 'node',
      plan: params.plan || 'starter',
      region: params.region || 'oregon',

      envSpecificDetails: {
        buildCommand:
          params.buildCommand || undefined,

        startCommand:
          params.startCommand || undefined,
      },
    };

    if (params.preDeployCommand) {
      serviceDetails.preDeployCommand =
        params.preDeployCommand;
    }

    if (
      params.healthCheckPath &&
      (
        params.type === 'web_service' ||
        params.type === 'private_service'
      )
    ) {
      serviceDetails.healthCheckPath =
        params.healthCheckPath;
    }

    if (
      params.envVars &&
      params.envVars.length > 0
    ) {
      serviceDetails.envVars =
        params.envVars.map((v) => ({
          key: v.key,
          value: v.value,
        }));
    }

    const payload: any = {
      type: params.type,

      name: params.name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32),

      ownerId,

      repo: params.repo,

      branch:
        params.branch || 'main',

      autoDeploy:
        params.autoDeploy ? 'yes' : 'no',

      serviceDetails,
    };

    const res = await this.request<any>(
      '/services',
      {
        method: 'POST',
        body: payload,
      }
    );

    return res.service || res;
  }

  async updateService(
    serviceId: string,
    updates: {
      name?: string;
      branch?: string;
      autoDeploy?: boolean;
      serviceDetails?: {
        buildCommand?: string;
        startCommand?: string;
        plan?: string;
      };
    }
  ): Promise<RenderServiceDetail> {
    const body: any = {};

    if (updates.name) {
      body.name = updates.name;
    }

    if (updates.branch) {
      body.branch = updates.branch;
    }

    if (updates.autoDeploy !== undefined) {
      body.autoDeploy =
        updates.autoDeploy ? 'yes' : 'no';
    }

    if (updates.serviceDetails) {
      body.serviceDetails =
        updates.serviceDetails;
    }

    const res = await this.request<any>(
      `/services/${serviceId}`,
      {
        method: 'PATCH',
        body,
      }
    );

    return res.service || res;
  }

  async deleteService(
    serviceId: string
  ): Promise<void> {
    await this.request<void>(
      `/services/${serviceId}`,
      {
        method: 'DELETE',
      }
    );
  }

  async suspendService(
    serviceId: string
  ): Promise<void> {
    await this.request<void>(
      `/services/${serviceId}/suspend`,
      {
        method: 'POST',
      }
    );
  }

  async resumeService(
    serviceId: string
  ): Promise<void> {
    await this.request<void>(
      `/services/${serviceId}/resume`,
      {
        method: 'POST',
      }
    );
  }

  async restartService(
    serviceId: string
  ): Promise<void> {
    // Official Render restart endpoint

    try {
      await this.request<void>(
        `/services/${serviceId}/restart`,
        {
          method: 'POST',
        }
      );
    } catch (e: any) {
      // Fallback to trigger deploy

      console.warn(
        '[Render API] Restart endpoint fallback to deploy:',
        e.message
      );

      await this.triggerDeploy(
        serviceId,
        false
      );
    }
  }

  // --- Deploys ---

  async triggerDeploy(
    serviceId: string,
    clearCache = false
  ): Promise<RenderDeploy> {
    const res = await this.request<any>(
      `/services/${serviceId}/deploys`,
      {
        method: 'POST',
        body: {
          clearCache: clearCache
            ? 'clear'
            : 'do_not_clear',
        },
      }
    );

    return res.deploy || res;
  }

  async listDeploys(
    serviceId: string,
    limit = 20
  ): Promise<RenderDeploy[]> {
    const res = await this.request<any[]>(
      `/services/${serviceId}/deploys?limit=${limit}`
    );

    if (Array.isArray(res)) {
      return res.map((item) => {
        return item.deploy
          ? item.deploy
          : item;
      });
    }

    return [];
  }

  async getDeploy(
    serviceId: string,
    deployId: string
  ): Promise<RenderDeploy> {
    const res = await this.request<any>(
      `/services/${serviceId}/deploys/${deployId}`
    );

    return res.deploy || res;
  }

  // --- Environment Variables ---

  async getEnvVars(
    serviceId: string
  ): Promise<Array<{
    key: string;
    value: string;
  }>> {
    const res = await this.request<any[]>(
      `/services/${serviceId}/env-vars`
    );

    if (Array.isArray(res)) {
      return res.map((item) => {
        const val =
          item.envVar || item;

        return {
          key: val.key,
          value: val.value ?? '',
        };
      });
    }

    return [];
  }

  async updateEnvVars(
    serviceId: string,
    envVars: Array<{
      key: string;
      value: string;
    }>
  ): Promise<Array<{
    key: string;
    value: string;
  }>> {
    const body = envVars.map((v) => ({
      key: v.key,
      value: v.value,
    }));

    const res = await this.request<any[]>(
      `/services/${serviceId}/env-vars`,
      {
        method: 'PUT',
        body,
      }
    );

    if (Array.isArray(res)) {
      return res.map((item) => {
        const val =
          item.envVar || item;

        return {
          key: val.key,
          value: val.value ?? '',
        };
      });
    }

    return envVars;
  }

  // --- Logs & Events ---

  async getServiceLogs(
    serviceId: string,
    _limit = 100
  ): Promise<string[]> {
    try {
      // Query recent deploys and events

      const deploys =
        await this.listDeploys(
          serviceId,
          5
        );

      const logs: string[] = [];

      const service =
        await this.getService(serviceId);

      const isSuspended =
        service.suspended === 'suspended';

      logs.push(
        `[${new Date(
          service.createdAt
        ).toLocaleTimeString()}] [RENDER] Service '${service.name}' registered (Type: ${service.type}, Region: ${service.serviceDetails.region})`
      );

      if (deploys.length > 0) {
        for (
          const dep of deploys.reverse()
        ) {
          const time =
            new Date(
              dep.createdAt
            ).toLocaleTimeString();

          logs.push(
            `[${time}] [DEPLOY #${dep.id.slice(
              -6
            )}] Trigger: ${
              dep.trigger || 'manual'
            } | Status: ${dep.status.toUpperCase()}`
          );

          if (dep.commit) {
            logs.push(
              `[${time}] [GIT] Commit: ${
                dep.commit.message ||
                dep.commit.id
              }`
            );
          }

          if (dep.status === 'live') {
            logs.push(
              `[${time}] [RUNTIME] Application deployed and running successfully.`
            );

            if (
              service.serviceDetails.url
            ) {
              logs.push(
                `[${time}] [NETWORK] Listening on ${service.serviceDetails.url}`
              );
            }
          } else if (
            dep.status ===
            'build_in_progress'
          ) {
            logs.push(
              `[${time}] [BUILD] Building environment container & running buildCommand...`
            );
          } else if (
            dep.status === 'build_failed'
          ) {
            logs.push(
              `[${time}] [ERROR] Build step failed. Check buildCommand syntax or dependencies.`
            );
          }
        }
      } else {
        logs.push(
          `[${new Date().toLocaleTimeString()}] [SYSTEM] Service initialized. Waiting for first deploy trigger.`
        );
      }

      if (isSuspended) {
        logs.push(
          `[${new Date().toLocaleTimeString()}] [STATUS] Service is currently SUSPENDED.`
        );
      }

      return logs;
    } catch (e: any) {
      return [
        `[${new Date().toLocaleTimeString()}] [ERROR] Unable to retrieve logs: ${e.message}`,
      ];
    }
  }

  // --- Status Normalization ---

  normalizeStatus(
    rawStatus?: string,
    suspended?: string
  ): ServerStatus {
    if (
      suspended === 'suspended'
    ) {
      return 'SUSPENDED';
    }

    if (!rawStatus) {
      return 'UNKNOWN';
    }

    const s =
      rawStatus.toLowerCase();

    if (s === 'live') {
      return 'ONLINE';
    }

    if (
      s === 'build_in_progress'
    ) {
      return 'BUILDING';
    }

    if (
      s === 'update_in_progress'
    ) {
      return 'DEPLOYING';
    }

    if (s === 'created') {
      return 'CREATING';
    }

    if (
      s === 'deactivated' ||
      s === 'suspended'
    ) {
      return 'SUSPENDED';
    }

    if (
      s === 'build_failed' ||
      s === 'update_failed' ||
      s === 'canceled'
    ) {
      return 'FAILED';
    }

    return 'UNKNOWN';
  }
}

export const renderApi =
  new RenderApiClient();
