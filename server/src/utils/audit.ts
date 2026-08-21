import crypto from 'crypto';
import pool from '../config/database';

interface AuditParams {
  userId?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export function logAudit({ userId, action, details, ipAddress }: AuditParams): void {
  try {
    pool.query(
      `INSERT INTO audit_log (id, user_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId || null,
        action,
        details ? JSON.stringify(details) : null,
        ipAddress || null,
      ]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}
