import { Router } from 'express';
import { db } from '../db/index.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';

export const activityRouter = Router();

activityRouter.use(authMiddleware);

// GET /api/v1/activity - List user or server activities
activityRouter.get('/', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const serverId = req.query['serverId'] as string;
  const limit = Math.min(Number(req.query['limit']) || 50, 100);

  let logs;
  if (serverId) {
    logs = db.getServerActivityLogs(serverId, limit);
  } else if (isAdmin && req.query['all'] === 'true') {
    logs = db.getActivityLogs(undefined, limit);
  } else {
    logs = db.getActivityLogs(user.id, limit);
  }

  res.json({
    object: 'list',
    data: logs,
  });
});
