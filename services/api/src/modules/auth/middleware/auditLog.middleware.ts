// ============================================================================
// AUDIT LOG MIDDLEWARE
// ============================================================================
// Tracks all authentication and authorization events
// Critical for security, compliance, and debugging
// ============================================================================

import { Response, NextFunction } from 'express';
import { logger } from '@/core/logging/logger';
import { AUTH_EVENTS } from '../constants/auth.constants';
import type { AuthRequest, AuditLogEntry } from '../types/auth.types';

/**
 * Audit log storage (in-memory for now, use database in production)
 */
const auditLogs: AuditLogEntry[] = [];
const MAX_LOGS_IN_MEMORY = 1000; // Keep only last 1000 in memory

/**
 * Audit logger middleware
 * Logs all requests to authenticated endpoints
 * 
 * Usage:
 *   router.use('/api/v1', auditLogger);
 *   // Or on specific routes:
 *   router.post('/sensitive', authenticate, auditLogger, controller.method);
 */
export function auditLogger(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // Capture start time
  const startTime = Date.now();

  // Capture original end method
  const originalEnd = res.end;
  let responseLogged = false;

  // Override end method to capture response
  res.end = function (chunk?: any, encoding?: any, callback?: any): any {
    // Restore original end method
    res.end = originalEnd;

    // Log only once
    if (!responseLogged) {
      responseLogged = true;

      // Calculate duration
      const duration = Date.now() - startTime;

      // Create audit log entry
      const auditEntry: AuditLogEntry = {
        event: determineEvent(req, res),
        userId: req.user?.id,
        organizationId: req.user?.organizationId,
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.headers['user-agent'],
        },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        success: res.statusCode < 400,
      };

      // Add error message if failed
      if (!auditEntry.success) {
        auditEntry.errorMessage = `Request failed with status ${res.statusCode}`;
      }

      // Log the audit entry
      logAuditEntry(auditEntry);
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
}

/**
 * Log specific auth event
 * Use this for explicit event logging (login, logout, etc.)
 * 
 * Usage:
 *   await logAuthEvent(AUTH_EVENTS.LOGIN_SUCCESS, req, { username: 'user123' });
 * 
 * @param event - Event name from AUTH_EVENTS
 * @param req - Express request
 * @param metadata - Additional metadata
 */
export async function logAuthEvent(
  event: string,
  req: AuthRequest,
  metadata?: Record<string, any>
): Promise<void> {
  const auditEntry: AuditLogEntry = {
    event,
    userId: req.user?.id,
    organizationId: req.user?.organizationId,
    metadata: {
      ...metadata,
      path: req.path,
      method: req.method,
    },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    timestamp: new Date(),
    success: true,
  };

  logAuditEntry(auditEntry);
}

/**
 * Log failed auth event
 * 
 * @param event - Event name
 * @param req - Express request
 * @param error - Error message or object
 * @param metadata - Additional metadata
 */
export async function logAuthFailure(
  event: string,
  req: AuthRequest,
  error: string | Error,
  metadata?: Record<string, any>
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;

  const auditEntry: AuditLogEntry = {
    event,
    userId: req.user?.id,
    organizationId: req.user?.organizationId,
    metadata: {
      ...metadata,
      path: req.path,
      method: req.method,
    },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    timestamp: new Date(),
    success: false,
    errorMessage,
  };

  logAuditEntry(auditEntry);
}

/**
 * Store audit log entry
 * In production, this should write to database
 * 
 * @param entry - Audit log entry
 */
function logAuditEntry(entry: AuditLogEntry): void {
  // Add to in-memory store
  auditLogs.push(entry);

  // Keep only recent logs in memory
  if (auditLogs.length > MAX_LOGS_IN_MEMORY) {
    auditLogs.shift(); // Remove oldest
  }

  // Log to Winston (for immediate visibility)
  if (entry.success) {
    logger.info('Audit log', entry);
  } else {
    logger.warn('Audit log - Failed', entry);
  }

  // TODO: In production, save to database
  // await prisma.auditLog.create({ data: entry });
}

/**
 * Determine event name based on request
 * 
 * @param req - Express request
 * @param res - Express response
 * @returns Event name
 */
function determineEvent(req: AuthRequest, res: Response): string {
  const path = req.path;
  const method = req.method;
  const success = res.statusCode < 400;

  // Auth endpoints
  if (path.includes('/auth/login')) {
    return success ? AUTH_EVENTS.LOGIN_SUCCESS : AUTH_EVENTS.LOGIN_FAILURE;
  }
  if (path.includes('/auth/logout')) {
    return AUTH_EVENTS.LOGOUT;
  }
  if (path.includes('/auth/register')) {
    return AUTH_EVENTS.REGISTER;
  }
  if (path.includes('/auth/verify-email')) {
    return AUTH_EVENTS.EMAIL_VERIFIED;
  }
  if (path.includes('/auth/change-password')) {
    return AUTH_EVENTS.PASSWORD_CHANGED;
  }
  if (path.includes('/auth/reset-password')) {
    return path.includes('/request')
      ? AUTH_EVENTS.PASSWORD_RESET_REQUESTED
      : AUTH_EVENTS.PASSWORD_RESET;
  }
  if (path.includes('/auth/refresh')) {
    return AUTH_EVENTS.TOKEN_REFRESHED;
  }

  // Generic events
  return `${method.toLowerCase()}.${path.replace(/\//g, '.')}`;
}

/**
 * Get audit logs for a user
 * 
 * @param userId - User ID
 * @param limit - Number of logs to return
 * @returns Array of audit log entries
 */
export function getUserAuditLogs(
  userId: string,
  limit: number = 100
): AuditLogEntry[] {
  return auditLogs
    .filter((log) => log.userId === userId)
    .slice(-limit)
    .reverse();
}

/**
 * Get audit logs for an organization
 * 
 * @param organizationId - Organization ID
 * @param limit - Number of logs to return
 * @returns Array of audit log entries
 */
export function getOrganizationAuditLogs(
  organizationId: string,
  limit: number = 100
): AuditLogEntry[] {
  return auditLogs
    .filter((log) => log.organizationId === organizationId)
    .slice(-limit)
    .reverse();
}

/**
 * Get audit logs by event type
 * 
 * @param event - Event name
 * @param limit - Number of logs to return
 * @returns Array of audit log entries
 */
export function getAuditLogsByEvent(
  event: string,
  limit: number = 100
): AuditLogEntry[] {
  return auditLogs
    .filter((log) => log.event === event)
    .slice(-limit)
    .reverse();
}

/**
 * Get failed audit logs
 * Useful for security monitoring
 * 
 * @param limit - Number of logs to return
 * @returns Array of failed audit log entries
 */
export function getFailedAuditLogs(limit: number = 100): AuditLogEntry[] {
  return auditLogs
    .filter((log) => !log.success)
    .slice(-limit)
    .reverse();
}

/**
 * Search audit logs
 * 
 * @param criteria - Search criteria
 * @param limit - Number of logs to return
 * @returns Array of matching audit log entries
 */
export function searchAuditLogs(
  criteria: {
    userId?: string;
    organizationId?: string;
    event?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
  },
  limit: number = 100
): AuditLogEntry[] {
  let filtered = auditLogs;

  if (criteria.userId) {
    filtered = filtered.filter((log) => log.userId === criteria.userId);
  }
  if (criteria.organizationId) {
    filtered = filtered.filter((log) => log.organizationId === criteria.organizationId);
  }
  if (criteria.event) {
    filtered = filtered.filter((log) => log.event === criteria.event);
  }
  if (criteria.success !== undefined) {
    filtered = filtered.filter((log) => log.success === criteria.success);
  }
  if (criteria.startDate) {
    filtered = filtered.filter((log) => log.timestamp >= criteria.startDate!);
  }
  if (criteria.endDate) {
    filtered = filtered.filter((log) => log.timestamp <= criteria.endDate!);
  }
  if (criteria.ipAddress) {
    filtered = filtered.filter((log) => log.ipAddress === criteria.ipAddress);
  }

  return filtered.slice(-limit).reverse();
}

/**
 * Get audit log statistics
 * Useful for security dashboards
 * 
 * @param userId - Optional user ID to filter by
 * @returns Statistics object
 */
export function getAuditStats(userId?: string): {
  total: number;
  successful: number;
  failed: number;
  byEvent: Record<string, number>;
  recentActivity: AuditLogEntry[];
} {
  let logs = userId
    ? auditLogs.filter((log) => log.userId === userId)
    : auditLogs;

  const byEvent: Record<string, number> = {};
  let successful = 0;
  let failed = 0;

  for (const log of logs) {
    byEvent[log.event] = (byEvent[log.event] || 0) + 1;
    if (log.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return {
    total: logs.length,
    successful,
    failed,
    byEvent,
    recentActivity: logs.slice(-10).reverse(),
  };
}

/**
 * Clean up old audit logs from memory
 * Should be called periodically
 * In production, this would archive to cold storage
 */
export function cleanupOldAuditLogs(daysToKeep: number = 30): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const originalLength = auditLogs.length;
  
  // Remove logs older than cutoff
  while (auditLogs.length > 0 && auditLogs[0].timestamp < cutoffDate) {
    auditLogs.shift();
  }

  const removed = originalLength - auditLogs.length;

  if (removed > 0) {
    logger.info('Cleaned up old audit logs', {
      removed,
      remaining: auditLogs.length,
    });
  }

  return removed;
}

// Schedule cleanup daily
setInterval(() => cleanupOldAuditLogs(), 24 * 60 * 60 * 1000);
