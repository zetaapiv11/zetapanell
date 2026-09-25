import { Router } from 'express';
import { config, formatAdminWhatsApp } from '../config.js';
import { db } from '../db/index.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { logActivity } from '../services/audit.js';

export const billingRouter = Router();

export interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  priceIdr: number;
  priceUsd: number;
  maxServers: number;
  maxStorageMb: number;
  features: string[];
  recommended?: boolean;
}

export const HOSTING_PLANS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Bot Starter',
    tagline: 'Ideal for 1 Discord bot or single background daemon',
    priceIdr: 25000,
    priceUsd: 1.99,
    maxServers: 1,
    maxStorageMb: 2048,
    features: [
      '1 Active Server on Render (Background Worker)',
      '512 MB RAM / 0.5 CPU',
      '2 GB Cloudflare R2 Storage',
      'Node.js (discord.js) & Python (discord.py)',
      '24/7 Always-On (No Sleep)',
      'Real-Time Live Web Console',
    ],
  },
  {
    id: 'developer',
    name: 'Developer Worker',
    tagline: 'Best for multiple bots, staging APIs, and active workflows',
    priceIdr: 65000,
    priceUsd: 4.5,
    maxServers: 3,
    maxStorageMb: 10240,
    recommended: true,
    features: [
      '3 Active Servers on Render',
      '1 GB RAM / 1.0 CPU per service',
      '10 GB Cloudflare R2 Storage',
      'Instant ZIP Upload & Auto-Extract',
      'Internal Git Bridge & Render Deploy',
      'Environment Variables Encryption',
      'Unlimited Restarts & Deploys',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Power Cluster',
    tagline: 'High concurrency bots, web services, and production daemons',
    priceIdr: 150000,
    priceUsd: 9.99,
    maxServers: 8,
    maxStorageMb: 40960,
    features: [
      '8 Active Servers on Render',
      '2 GB RAM / 2.0 CPU per service',
      '40 GB Cloudflare R2 Storage',
      'Priority Render Deployment Pipeline',
      'Custom Domains & Automatic SSL',
      'Granular REST API Keys Access',
      'Full Audit Activity Trail',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Dedicated',
    tagline: 'Full agency or community scale infrastructure',
    priceIdr: 350000,
    priceUsd: 24.0,
    maxServers: 25,
    maxStorageMb: 153600,
    features: [
      '25 Active Servers on Render',
      'Render Dedicated Workspace integration',
      '150 GB Cloudflare R2 Storage',
      'Direct S3 Custom Bucket Support',
      'Dedicated Discord / Ticket Support',
      'Custom Subdomain & White-labeling',
    ],
  },
];

// GET /api/v1/billing/plans - List all plans (public, no auth required)
billingRouter.get('/plans', (_req, res) => {
  res.json({
    object: 'list',
    data: HOSTING_PLANS,
    adminWhatsApp: {
      number: config.adminWhatsApp,
      display: formatAdminWhatsApp(),
    },
  });
});

// POST /api/v1/billing/subscribe - Request / activate plan
billingRouter.use(authMiddleware);

billingRouter.post('/subscribe', (req: AuthenticatedRequest, res) => {
  const { planId, paymentMethod = 'QRIS / Manual Transfer' } = req.body;
  const user = req.user!;

  const plan = HOSTING_PLANS.find((p) => p.id === planId);
  if (!plan) {
    res.status(404).json({ error: 'Selected plan not found.' });
    return;
  }

  // Upgrades must be verified and executed by Admin via Admin Panel or WhatsApp order
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  if (!isSuperAdmin) {
    res.status(403).json({
      error: `Aktivasi dan upgrade paket dilakukan secara manual oleh Admin melalui WhatsApp ${formatAdminWhatsApp()} setelah pembayaran diverifikasi.`,
    });
    return;
  }

  const updatedUser = db.updateUser(user.id, {
    plan: plan.name,
    maxServers: plan.maxServers,
    maxStorageMb: plan.maxStorageMb,
  });

  logActivity({
    userId: user.id,
    username: user.username,
    action: 'billing.subscribe',
    details: `User subscribed to plan '${plan.name}' (Rp ${plan.priceIdr.toLocaleString('id-ID')}) via ${paymentMethod}`,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: isSuperAdmin
      ? `Plan ${plan.name} activated immediately for Super Admin!`
      : `Plan ${plan.name} selected! Quota updated to ${plan.maxServers} servers and ${plan.maxStorageMb}MB R2 storage.`,
    user: updatedUser,
    plan,
  });
});
