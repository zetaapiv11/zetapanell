import { z } from 'zod';
import { RENDER_SERVICE_TYPES } from '../services/render/renderServices.js';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const envVarSchema = z.object({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Env var keys must be alphanumeric/underscore.'),
  value: z.string(),
});

// Normalize legacy UI fields from the Angular form (`repoType` / `repoUrl`)
// into the API contract expected by the server (`deploymentSource` / `repository`).
const createServerInputSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;

  const input = raw;

  return {
    ...input,
    deploymentSource:
      input.deploymentSource ??
      (input.repoType === 'r2_managed' ? 'r2_zip' : 'git'),
    repository: input.repository ?? input.repoUrl,
  };
}, z.object({
  name: z.string().min(3).max(64),
  serviceType: z.enum(RENDER_SERVICE_TYPES),
  runtime: z.enum(['node', 'python', 'ruby', 'go', 'elixir', 'rust', 'docker']),
  region: z.string().min(1),
  plan: z.string().min(1),
  deploymentSource: z.enum(['git', 'r2_zip']).default('git'),
  repository: z.string().url().optional(),
  branch: z.string().min(1).default('main'),
  buildCommand: z.string().max(500).optional(),
  startCommand: z.string().max(500).optional(),
  preDeployCommand: z.string().max(500).optional(),
  autoDeploy: z.boolean().default(true),
  healthCheckPath: z.string().max(200).optional(),
  envVars: z.array(envVarSchema).max(100).default([]),
}).refine((data) => data.deploymentSource !== 'git' || !!data.repository, {
  message: 'repository is required when deploymentSource is "git".',
  path: ['repository'],
}).refine((data) => data.deploymentSource !== 'r2_zip' || !!data.startCommand, {
  message: 'startCommand is required when deploymentSource is "r2_zip".',
  path: ['startCommand'],
}));

export const createServerSchema = createServerInputSchema;

export const updateStartupSchema = z.object({
  buildCommand: z.string().max(500).optional(),
  startCommand: z.string().max(500).optional(),
  preDeployCommand: z.string().max(500).optional(),
  branch: z.string().min(1).optional(),
  autoDeploy: z.boolean().optional(),
  healthCheckPath: z.string().max(200).optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(64),
  permissions: z.array(z.string()).min(1),
});

export const presignUploadSchema = z.object({
  path: z.string().min(1),
  contentType: z.string().optional(),
});

export const renameFileSchema = z.object({
  fromPath: z.string().min(1),
  toPath: z.string().min(1),
});

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).default('USER'),
});

export const adminUpdateLimitsSchema = z.object({
  maxServers: z.number().int().min(0).optional(),
  maxStorageMb: z.number().int().min(0).optional(),
});
