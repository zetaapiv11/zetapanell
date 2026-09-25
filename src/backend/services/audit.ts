import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';

export interface AuditLogParams {
  userId: string;
  username: string;
  action: string;
  details: string;
  serverId?: string;
  serverName?: string;
  renderServiceId?: string;
  ip?: string;
}

export function logActivity(params: AuditLogParams): void {
  const timestamp = new Date().toISOString();

  // Structured stdout logging
  console.log(
    JSON.stringify({
      level: 'info',
      action: params.action,
      userId: params.userId,
      username: params.username,
      serverId: params.serverId || null,
      serverName: params.serverName || null,
      renderServiceId: params.renderServiceId || null,
      details: params.details,
      timestamp,
    })
  );

  // Database audit record
  db.addActivityLog({
    id: `act_${uuidv4().slice(0, 12)}`,
    userId: params.userId,
    username: params.username,
    serverId: params.serverId,
    serverName: params.serverName,
    action: params.action,
    details: params.details,
    ip: params.ip,
    timestamp,
  });
}
