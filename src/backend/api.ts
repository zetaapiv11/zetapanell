import { json, Router, urlencoded } from 'express';
import { activityRouter } from './routes/activity.js';
import { adminRouter } from './routes/admin.js';
import { apiKeysRouter } from './routes/apiKeys.js';
import { authRouter, pterodactylUserHandler } from './routes/auth.js';
import { docsRouter } from './routes/docs.js';
import { filesRouter } from './routes/files.js';
import { gitRouter } from './routes/git.js';
import { serversRouter } from './routes/servers.js';
import { billingRouter } from './routes/billing.js';
import { authMiddleware } from './middleware/auth.js';

export const apiRouter = Router();

// Middleware for API
apiRouter.use(json({ limit: '50mb' }));
apiRouter.use(urlencoded({ extended: true, limit: '50mb' }));

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ZetaPanel API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Git Bridge endpoints (unauthenticated clone/fetch for Render or with key)
apiRouter.use('/git', gitRouter);

// REST API v1 endpoints
apiRouter.use('/auth', authRouter);
apiRouter.get('/user', authMiddleware, pterodactylUserHandler); // GET /api/v1/user (matches /docs spec)
apiRouter.use('/servers', serversRouter);
apiRouter.use('/servers', filesRouter); // files endpoints are mounted under /servers/:id/files
apiRouter.use('/api-keys', apiKeysRouter);
apiRouter.use('/activity', activityRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/docs', docsRouter);
apiRouter.use('/billing', billingRouter);
