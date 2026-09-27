import { Router } from 'express';
import { config } from '../config.js';

export const docsRouter = Router();

docsRouter.get('/openapi.json', (req, res) => {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'ZetaPanel REST API',
      version: '1.0.0',
      description:
        'Official REST API for ZetaPanel Server Control Panel, integrating Render API for infrastructure operations and Cloudflare R2 for project storage.',
      contact: {
        name: 'ZetaPanel Engineering',
        url: config.appUrl,
      },
    },
    servers: [
      {
        url: `${config.appUrl}/api/v1`,
        description: 'Current Environment API Server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'zp_live_...',
          description: 'Authenticate using ZetaPanel API key generated from the panel.',
        },
        JwtAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Authenticate using user JWT session token.',
        },
      },
      schemas: {
        Server: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'srv_a1b2c3d4e5' },
            userId: { type: 'string' },
            renderServiceId: { type: 'string', example: 'srv-c1234567890' },
            name: { type: 'string', example: 'Discord Music Bot' },
            runtime: { type: 'string', enum: ['node', 'python', 'docker', 'go', 'ruby', 'elixir'] },
            serviceType: { type: 'string', enum: ['web_service', 'background_worker', 'private_service', 'cron_job'] },
            region: { type: 'string', example: 'oregon' },
            plan: { type: 'string', example: 'starter' },
            status: { type: 'string', enum: ['ONLINE', 'BUILDING', 'DEPLOYING', 'FAILED', 'SUSPENDED'] },
            serviceUrl: { type: 'string', example: 'https://mybot.onrender.com' },
            repoUrl: { type: 'string' },
            branch: { type: 'string', example: 'main' },
            buildCommand: { type: 'string', example: 'npm install' },
            startCommand: { type: 'string', example: 'npm start' },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }, { JwtAuth: [] }],
    paths: {
      '/user': {
        get: {
          summary: 'Get current user profile',
          responses: { 200: { description: 'Authenticated user details' } },
        },
      },
      '/servers': {
        get: {
          summary: 'List user servers with real-time Render status',
          responses: { 200: { description: 'Array of servers' } },
        },
        post: {
          summary: 'Create a new server on Render API and register in ZetaPanel',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'serviceType', 'runtime'],
                  properties: {
                    name: { type: 'string', example: 'discord-bot' },
                    serviceType: { type: 'string', example: 'background_worker' },
                    runtime: { type: 'string', example: 'node' },
                    repoType: { type: 'string', enum: ['git', 'r2_managed'] },
                    repoUrl: { type: 'string', example: 'https://github.com/example/bot.git' },
                    buildCommand: { type: 'string', example: 'npm install' },
                    startCommand: { type: 'string', example: 'npm start' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Server created on Render' } },
        },
      },
      '/servers/{id}': {
        get: { summary: 'Get server details and live status' },
        patch: { summary: 'Update server configuration on Render' },
        delete: { summary: 'Delete service from Render and optionally Cloudflare R2' },
      },
      '/servers/{id}/deploy': {
        post: { summary: 'Trigger a deployment on Render' },
      },
      '/servers/{id}/restart': {
        post: { summary: 'Restart Render service' },
      },
      '/servers/{id}/status': {
        get: { summary: 'Fetch live status from Render API' },
      },
      '/servers/{id}/logs': {
        get: { summary: 'Stream / fetch real Render service deployment and runtime logs' },
      },
      '/servers/{id}/env': {
        get: { summary: 'List environment variables from Render API' },
        post: { summary: 'Update environment variables on Render' },
      },
      '/servers/{id}/env/{key}': {
        delete: { summary: 'Delete an environment variable on Render' },
      },
      '/servers/{id}/files': {
        get: { summary: 'List files in Cloudflare R2' },
        delete: { summary: 'Delete file or directory in Cloudflare R2' },
      },
      '/servers/{id}/files/upload': {
        post: { summary: 'Upload file or extract ZIP archive to Cloudflare R2' },
      },
      '/servers/{id}/files/content': {
        get: { summary: 'Read file text content from Cloudflare R2' },
        put: { summary: 'Write file text content directly into Cloudflare R2' },
      },
      '/servers/{id}/files/sync-deploy': {
        post: { summary: 'Sync latest files from Cloudflare R2 to Git Bridge and trigger Render Deploy' },
      },
    },
  };

  res.json(spec);
});
