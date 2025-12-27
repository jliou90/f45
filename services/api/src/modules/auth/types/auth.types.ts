// ============================================================================
// AUTH TYPES
// ============================================================================
// Type definitions for the auth module
// Benefits:
// - Type safety throughout the module
// - Clear contracts
// - Self-documenting code
// - IDE autocomplete
// ============================================================================

import { Request } from 'express';

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  userId: string;
  organizationId: string;
  role: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Authenticated user data (attached to request)
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: string;
  organizationId: string;
  locationId?: string;
  permissions?: string[];
}

/**
 * Extended Express Request with user
 */
export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

/**
 * Login attempt tracking
 */
export interface LoginAttempt {
  identifier: string; // username or IP
  attempts: number;
  lockedUntil?: Date;
  lastAttempt: Date;
}

/**
 * Verification token data
 */
export interface VerificationToken {
  userId: string;
  email: string;
  type: 'email_verification' | 'password_reset';
  expiresAt: Date;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  os?: string;
  location?: {
    country?: string;
    city?: string;
  };
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  event: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
  score: number; // 0-100
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

/**
 * Authentication result
 */
export interface AuthenticationResult {
  success: boolean;
  user?: AuthenticatedUser;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  requiresVerification?: boolean;
  requires2FA?: boolean;
}

/**
 * Token pair
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Email verification payload
 */
export interface EmailVerificationPayload {
  userId: string;
  email: string;
  token: string;
}

/**
 * Password reset payload
 */
export interface PasswordResetPayload {
  userId: string;
  email: string;
  token: string;
}

/**
 * User context (for logging and audit)
 */
export interface UserContext {
  userId: string;
  username: string;
  organizationId: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  requiredPermissions?: string[];
  userPermissions?: string[];
}

/**
 * Security event
 */
export interface SecurityEvent {
  type: 'login_failure' | 'account_locked' | 'suspicious_activity' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  organizationId?: string;
  details: Record<string, any>;
  timestamp: Date;
}

/**
 * Session info
 */
export interface SessionInfo {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  metadata: SessionMetadata;
  isValid: boolean;
}
