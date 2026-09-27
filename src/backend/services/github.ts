import { config } from '../config.js';
import { db } from '../db/index.js';

export interface GithubRepoInfo {
  fullName: string; // "owner/repo"
  htmlUrl: string; // https://github.com/owner/repo (what Render's `repo` field wants)
  pushUrl: string; // https://x-access-token:TOKEN@github.com/owner/repo.git (for git push, has the secret embedded — never log this)
  defaultBranch: string;
}

class GithubService {
  private baseUrl = 'https://api.github.com';

  private getToken(): string {
    const settings = db.getSettings();
    const token = settings.githubToken || config.githubToken;
    if (!token) {
      throw new Error(
        'GitHub is not configured. Set GITHUB_TOKEN (a Personal Access Token with the "repo" scope) in environment or Admin Settings.'
      );
    }
    return token;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: any } = {}
  ): Promise<{ status: number; data: T }> {
    const token = this.getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ZetaPanel/1.0.0',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  }

  /** Resolves the login of the token's own account (used when GITHUB_OWNER is unset). */
  private async getAuthenticatedLogin(): Promise<string> {
    const { status, data } = await this.request<{ login: string }>('/user');
    if (status !== 200) {
      throw new Error(
        `GitHub token rejected when resolving authenticated user (HTTP ${status}). Check that GITHUB_TOKEN is valid and has the "repo" scope.`
      );
    }
    return data.login;
  }

  private slugifyRepoName(name: string, serverId: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    // Keep the serverId suffix so repo names never collide between users/servers.
    return `${slug || 'zetapanel-service'}-${serverId.replace(/^srv_/, '')}`;
  }

  /**
   * Creates the GitHub repo for a server if it doesn't exist yet (idempotent —
   * a 422 "name already exists" is treated as success), and returns the info
   * needed to push to it and to hand to Render as the service's `repo` URL.
   */
  async ensureRepo(serverId: string, nameHint: string): Promise<GithubRepoInfo> {
    const settings = db.getSettings();
    const owner = (settings.githubOwner || config.githubOwner || '').trim();
    const ownerType = (settings.githubOwnerType || config.githubOwnerType || 'user') as 'user' | 'org';
    const visibility = (settings.githubVisibility || config.githubVisibility || 'private') as
      | 'private'
      | 'public';

    const repoName = this.slugifyRepoName(nameHint, serverId);
    const resolvedOwner = owner || (await this.getAuthenticatedLogin());

    const createPath = owner && ownerType === 'org' ? `/orgs/${resolvedOwner}/repos` : '/user/repos';

    const { status, data } = await this.request<any>(createPath, {
      method: 'POST',
      body: {
        name: repoName,
        private: visibility === 'private',
        auto_init: false,
        description: `ZetaPanel-managed server ${serverId}`,
      },
    });

    // 201 = created. 422 with "already exists" = fine, someone/something already made it
    // (e.g. a retry after a network hiccup) — just proceed to use it.
    if (status !== 201 && status !== 422) {
      throw new Error(
        `GitHub repo creation failed (HTTP ${status}): ${data?.message || JSON.stringify(data)}`
      );
    }

    const fullName = `${resolvedOwner}/${repoName}`;
    const token = this.getToken();

    return {
      fullName,
      htmlUrl: `https://github.com/${fullName}`,
      pushUrl: `https://x-access-token:${token}@github.com/${fullName}.git`,
      defaultBranch: data?.default_branch || 'main',
    };
  }

  /** Rebuilds the push URL for a repo that's already known to exist (no API call). */
  buildPushUrl(fullName: string): string {
    const token = this.getToken();
    return `https://x-access-token:${token}@github.com/${fullName}.git`;
  }

  async deleteRepo(fullName: string): Promise<void> {
    try {
      await this.request(`/repos/${fullName}`, { method: 'DELETE' });
    } catch (e) {
      console.warn(`[GitHub] Failed to delete repo ${fullName} (may already be gone):`, e);
    }
  }
}

export const githubService = new GithubService();
