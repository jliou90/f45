// ============================================================================
// RATE LIMIT MIDDLEWARE
// ============================================================================
// Prevents abuse by limiting requests per time window
// Critical for security (brute force, DoS prevention)
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { ApiError } from '@/shared/errors/ApiError';
import { logger } from '@/core/logging/logger';
import { AUTH_ERRORS, AUTH_CONFIG } from '../constants/auth.constants';

/**
 * Rate limit store (in-memory for now, use Redis in production)
 * Maps IP/identifier to attempt count and reset time
 */
const rateLimitStore = new Map<string, {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}>();

/**
 * General API rate limiter
 * Limits requests per IP address
 * 
 * Default: 100 requests per 15 minutes
 */
export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: AUTH_ERRORS.TOO_MANY_REQUESTS,
    },
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  // Skip successful requests in count (optional)
  skipSuccessfulRequests: false,
  // Skip failed requests in count (optional)
  skipFailedRequests: false,
  // Custom key generator (use IP by default)
  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  // Custom handler for rate limit exceeded
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: AUTH_ERRORS.TOO_MANY_REQUESTS,
      },
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 * 
 * Default: 5 attempts per 15 minutes
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: AUTH_CONFIG.LOGIN_ATTEMPT_WINDOW,
  max: AUTH_CONFIG.MAX_LOGIN_ATTEMPTS,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: AUTH_ERRORS.TOO_MANY_LOGIN_ATTEMPTS,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use username from body OR IP as key
  keyGenerator: (req: Request) => {
    const username = req.body?.username;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return username || ip;
  },
  handler: (req: Request, res: Response) => {
    const identifier = req.body?.username || req.ip;
    
    logger.warn('Too many login attempts', {
      identifier,
      ip: req.ip,
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        message: AUTH_ERRORS.TOO_MANY_LOGIN_ATTEMPTS.replace(
          '{minutes}',
          String(Math.ceil(AUTH_CONFIG.LOGIN_ATTEMPT_WINDOW / 60000))
        ),
      },
    });
  },
});

/**
 * Custom rate limiter with account lockout
 * Locks account after too many failed attempts
 * 
 * @param identifier - Username or email
 * @returns Boolean indicating if request should be allowed
 */
export function checkLoginAttempts(identifier: string): {
  allowed: boolean;
  remaining: number;
  lockedUntil?: Date;
} {
  const now = Date.now();
  const key = `login:${identifier}`;
  const attempt = rateLimitStore.get(key);

  // If no previous attempts or window expired, allow
  if (!attempt || now > attempt.resetAt) {
    rateLimitStore.set(key, {
      count: 0,
      resetAt: now + AUTH_CONFIG.LOGIN_ATTEMPT_WINDOW,
    });
    return { allowed: true, remaining: AUTH_CONFIG.MAX_LOGIN_ATTEMPTS };
  }

  // If account is locked
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      lockedUntil: new Date(attempt.lockedUntil),
    };
  }

  // If lock expired, reset
  if (attempt.lockedUntil && now >= attempt.lockedUntil) {
    rateLimitStore.set(key, {
      count: 0,
      resetAt: now + AUTH_CONFIG.LOGIN_ATTEMPT_WINDOW,
    });
    return { allowed: true, remaining: AUTH_CONFIG.MAX_LOGIN_ATTEMPTS };
  }

  // Check if limit reached
  if (attempt.count >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
    // Lock the account
    attempt.lockedUntil = now + AUTH_CONFIG.LOCKOUT_DURATION;
    rateLimitStore.set(key, attempt);

    logger.warn('Account locked due to too many failed attempts', {
      identifier,
      lockedUntil: new Date(attempt.lockedUntil),
    });

    return {
      allowed: false,
      remaining: 0,
      lockedUntil: new Date(attempt.lockedUntil),
    };
  }

  // Allow but increment count
  return {
    allowed: true,
    remaining: AUTH_CONFIG.MAX_LOGIN_ATTEMPTS - attempt.count,
  };
}

/**
 * Record failed login attempt
 * 
 * @param identifier - Username or email
 */
export function recordFailedLogin(identifier: string): void {
  const now = Date.now();
  const key = `login:${identifier}`;
  const attempt = rateLimitStore.get(key);

  if (!attempt || now > attempt.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + AUTH_CONFIG.LOGIN_ATTEMPT_WINDOW,
    });
  } else {
    attempt.count += 1;
    rateLimitStore.set(key, attempt);
  }

  logger.debug('Failed login attempt recorded', {
    identifier,
    attempts: attempt ? attempt.count : 1,
  });
}

/**
 * Clear login attempts on successful login
 * 
 * @param identifier - Username or email
 */
export function clearLoginAttempts(identifier: string): void {
  const key = `login:${identifier}`;
  rateLimitStore.delete(key);
  
  logger.debug('Login attempts cleared', { identifier });
}

/**
 * Strict rate limiter for password reset
 * Prevents abuse of password reset functionality
 * 
 * Default: 3 requests per hour
 */
export const passwordResetRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_RESET_REQUESTS',
      message: 'Too many password reset requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = req.body?.email;
    const ip = req.ip || 'unknown';
    return email || ip;
  },
});

/**
 * Rate limiter for email verification resend
 * 
 * Default: 3 requests per 15 minutes
 */
export const emailVerificationRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_VERIFICATION_REQUESTS',
      message: 'Too many verification email requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for registration
 * Prevents mass account creation
 * 
 * Default: 5 accounts per hour per IP
 */
export const registrationRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REGISTRATIONS',
      message: 'Too many registration attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Clean up expired rate limit entries
 * Should be called periodically (e.g., every hour)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, attempt] of rateLimitStore.entries()) {
    // Remove if reset time has passed and not locked
    if (now > attempt.resetAt && (!attempt.lockedUntil || now > attempt.lockedUntil)) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info('Cleaned up rate limit entries', { count: cleaned });
  }
}

// Schedule cleanup every hour
setInterval(cleanupRateLimits, 60 * 60 * 1000);
