// ============================================================================
// AUTH MIDDLEWARE - Index
// ============================================================================
// Central export point for all authentication middleware
// ============================================================================

// Authentication
export {
  authenticate,
  optionalAuthenticate,
  requireEmailVerification,
  validateToken,
} from './authenticate.middleware';

// Authorization
export {
  authorizeRoles,
  authorizePermission,
  authorizeAnyPermission,
  authorizeAllPermissions,
  authorizeOrganization,
  authorizeOwnership,
  adminOnly,
  managerOrAbove,
} from './authorize.middleware';

// Validation
export {
  validate,
  validateAll,
  validateWithHandler,
  validateAndSanitize,
  validateArray,
  getFirstError,
  commonValidations,
} from './validate.middleware';

// Rate Limiting
export {
  apiRateLimiter,
  authRateLimiter,
  passwordResetRateLimiter,
  emailVerificationRateLimiter,
  registrationRateLimiter,
  checkLoginAttempts,
  recordFailedLogin,
  clearLoginAttempts,
  cleanupRateLimits,
} from './rateLimit.middleware';

// Audit Logging
export {
  auditLogger,
  logAuthEvent,
  logAuthFailure,
  getUserAuditLogs,
  getOrganizationAuditLogs,
  getAuditLogsByEvent,
  getFailedAuditLogs,
  searchAuditLogs,
  getAuditStats,
  cleanupOldAuditLogs,
} from './auditLog.middleware';
