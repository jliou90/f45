// ============================================================================
// AUTH CONSTANTS
// ============================================================================
// Centralized constants for the auth module
// Benefits:
// - Single source of truth
// - Easy to maintain
// - Consistent error messages
// - Easy to internationalize later
// ============================================================================

/**
 * Error messages
 */
export const AUTH_ERRORS = {
  // Credentials
  INVALID_CREDENTIALS: 'Invalid username or password',
  ACCOUNT_INACTIVE: 'Your account has been deactivated',
  ACCOUNT_LOCKED: 'Your account has been locked due to too many failed login attempts',
  
  // Registration
  USERNAME_EXISTS: 'Username already exists',
  EMAIL_EXISTS: 'Email address already exists',
  INVALID_ORGANIZATION: 'Invalid organization',
  
  // Email verification
  EMAIL_NOT_VERIFIED: 'Please verify your email address',
  INVALID_VERIFICATION_TOKEN: 'Invalid or expired verification token',
  EMAIL_ALREADY_VERIFIED: 'Email address is already verified',
  
  // Password
  WEAK_PASSWORD: 'Password does not meet security requirements',
  PASSWORD_MISMATCH: 'Passwords do not match',
  CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
  PASSWORD_RECENTLY_USED: 'You cannot reuse a recent password',
  
  // Tokens
  INVALID_TOKEN: 'Invalid or expired token',
  INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token',
  TOKEN_REVOKED: 'Token has been revoked',
  TOKEN_EXPIRED: 'Token has expired',
  
  // Sessions
  SESSION_NOT_FOUND: 'Session not found',
  SESSION_EXPIRED: 'Your session has expired',
  TOO_MANY_SESSIONS: 'Too many active sessions',
  
  // Rate limiting
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later',
  TOO_MANY_LOGIN_ATTEMPTS: 'Too many login attempts. Please try again in {minutes} minutes',
  
  // General
  UNAUTHORIZED: 'You must be logged in to access this resource',
  FORBIDDEN: 'You do not have permission to access this resource',
  USER_NOT_FOUND: 'User not found',
} as const;

/**
 * Success messages
 */
export const AUTH_SUCCESS = {
  LOGIN: 'Login successful',
  LOGOUT: 'Logout successful',
  REGISTER: 'Registration successful. Please check your email to verify your account',
  EMAIL_VERIFIED: 'Email verified successfully',
  VERIFICATION_EMAIL_SENT: 'Verification email sent',
  PASSWORD_CHANGED: 'Password changed successfully',
  PASSWORD_RESET_EMAIL_SENT: 'Password reset email sent',
  PASSWORD_RESET: 'Password reset successful',
  SESSION_REVOKED: 'Session revoked successfully',
} as const;

/**
 * Configuration constants
 */
export const AUTH_CONFIG = {
  // Password requirements
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_SPECIAL: true,
  
  // Tokens
  ACCESS_TOKEN_EXPIRY: '1h',
  REFRESH_TOKEN_EXPIRY: '7d',
  VERIFICATION_TOKEN_EXPIRY: '24h',
  PASSWORD_RESET_TOKEN_EXPIRY: '1h',
  
  // Rate limiting
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_ATTEMPT_WINDOW: 15 * 60 * 1000, // 15 minutes in ms
  LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes in ms
  
  // Sessions
  MAX_SESSIONS_PER_USER: 5,
  SESSION_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour in ms
  
  // Email verification
  REQUIRE_EMAIL_VERIFICATION: true,
  RESEND_EMAIL_COOLDOWN: 60 * 1000, // 1 minute in ms
  
  // Security
  BCRYPT_ROUNDS: 10,
  PASSWORD_HISTORY_SIZE: 5, // Remember last 5 passwords
} as const;

/**
 * Event names for audit logging
 */
export const AUTH_EVENTS = {
  // Login/Logout
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  LOGOUT: 'auth.logout',
  
  // Registration
  REGISTER: 'auth.register',
  
  // Email verification
  EMAIL_VERIFIED: 'auth.email.verified',
  VERIFICATION_EMAIL_SENT: 'auth.email.verification_sent',
  
  // Password
  PASSWORD_CHANGED: 'auth.password.changed',
  PASSWORD_RESET_REQUESTED: 'auth.password.reset_requested',
  PASSWORD_RESET: 'auth.password.reset',
  
  // Tokens
  TOKEN_REFRESHED: 'auth.token.refreshed',
  TOKEN_REVOKED: 'auth.token.revoked',
  
  // Sessions
  SESSION_CREATED: 'auth.session.created',
  SESSION_REVOKED: 'auth.session.revoked',
  
  // Security
  ACCOUNT_LOCKED: 'auth.security.account_locked',
  SUSPICIOUS_ACTIVITY: 'auth.security.suspicious_activity',
} as const;

/**
 * Permissions
 */
export const AUTH_PERMISSIONS = {
  // User management
  VIEW_USERS: 'users:read',
  CREATE_USER: 'users:create',
  UPDATE_USER: 'users:update',
  DELETE_USER: 'users:delete',
  
  // Role management
  VIEW_ROLES: 'roles:read',
  MANAGE_ROLES: 'roles:manage',
  
  // Session management
  VIEW_SESSIONS: 'sessions:read',
  REVOKE_SESSIONS: 'sessions:revoke',
} as const;

/**
 * Cache keys
 */
export const AUTH_CACHE_KEYS = {
  USER: (id: string) => `user:${id}`,
  SESSION: (token: string) => `session:${token}`,
  REFRESH_TOKEN: (token: string) => `refresh:${token}`,
  LOGIN_ATTEMPTS: (identifier: string) => `login_attempts:${identifier}`,
} as const;

/**
 * Cache TTLs (in seconds)
 */
export const AUTH_CACHE_TTL = {
  USER: 300, // 5 minutes
  SESSION: 3600, // 1 hour
  REFRESH_TOKEN: 604800, // 7 days
  LOGIN_ATTEMPTS: 900, // 15 minutes
} as const;
