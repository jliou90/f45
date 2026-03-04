// ============================================================================
// AUTHENTICATE MIDDLEWARE
// ============================================================================
// Verifies JWT token and attaches user to request
// This is the PRIMARY security middleware - protects all authenticated routes
// ============================================================================

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/app.config';
import { ApiError } from '@/shared/errors/ApiError';
import { logger } from '@/core/logging/logger';
import { userRepository } from '../repositories/auth.repository';
import { AUTH_ERRORS } from '../constants/auth.constants';
import type { AuthRequest, JwtPayload } from '../types/auth.types';

/**
 * Authentication middleware
 * Verifies JWT token and attaches authenticated user to request
 * 
 * Usage:
 *   router.get('/protected', authenticate, controller.method);
 * 
 * @param req - Express request (extended with user)
 * @param res - Express response
 * @param next - Express next function
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Extract token from Authorization header
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      throw ApiError.unauthorized(AUTH_ERRORS.UNAUTHORIZED);
    }

    // 2. Verify JWT token
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized(AUTH_ERRORS.TOKEN_EXPIRED);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw ApiError.unauthorized(AUTH_ERRORS.INVALID_TOKEN);
      }
      throw ApiError.unauthorized(AUTH_ERRORS.INVALID_TOKEN);
    }

    // 3. Verify token type
    if (payload.type !== 'access') {
      throw ApiError.unauthorized(AUTH_ERRORS.INVALID_TOKEN);
    }

    // 4. Fetch user from database (with fresh data)
    const user = await userRepository.findById(payload.userId);
    
    if (!user) {
      throw ApiError.unauthorized(AUTH_ERRORS.USER_NOT_FOUND);
    }

    // 5. Check if user is active
    if (!user.isActive) {
      throw ApiError.forbidden(AUTH_ERRORS.ACCOUNT_INACTIVE);
    }

    // 6. Attach user data to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      locationId: user.locationId || undefined,
    };

    // 7. Attach token to request (for session management)
    req.token = token;

    // Log successful authentication (debug level)
    logger.debug('User authenticated', {
      userId: user.id,
      username: user.username,
      role: user.role,
      path: req.path,
    });

    next();
  } catch (error) {
    // Log authentication failure
    logger.warn('Authentication failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    next(error);
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if missing
 * Useful for routes that have both public and authenticated behavior
 * 
 * Usage:
 *   router.get('/mixed', optionalAuthenticate, controller.method);
 */
export async function optionalAuthenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req);
    
    // If no token, just continue without user
    if (!token) {
      return next();
    }

    // Try to verify and attach user
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      
      if (payload.type === 'access') {
        const user = await userRepository.findById(payload.userId);
        
        if (user && user.isActive) {
          req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            locationId: user.locationId || undefined,
          };
          req.token = token;
        }
      }
    } catch (error) {
      // Silently fail for optional auth
      logger.debug('Optional authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Extract JWT token from Authorization header
 * Supports: "Bearer <token>" format
 * 
 * @param req - Express request
 * @returns Token string or null
 */
function extractTokenFromHeader(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Check for "Bearer <token>" format
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Require email verification middleware
 * Use after authenticate to ensure user has verified email
 * 
 * Usage:
 *   router.post('/sensitive', authenticate, requireEmailVerification, controller.method);
 */
export async function requireEmailVerification(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw ApiError.unauthorized(AUTH_ERRORS.UNAUTHORIZED);
    }

    const user = await userRepository.findById(req.user.id);
    
    if (!user) {
      throw ApiError.unauthorized(AUTH_ERRORS.USER_NOT_FOUND);
    }

    if (!user.emailVerified) {
      throw ApiError.forbidden(AUTH_ERRORS.EMAIL_NOT_VERIFIED);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Validate token middleware
 * Checks token validity without attaching user (for token validation endpoints)
 * 
 * @param token - Token to validate
 * @returns Promise<boolean>
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    
    if (payload.type !== 'access') {
      return false;
    }

    const user = await userRepository.findById(payload.userId);
    
    return user !== null && user.isActive;
  } catch (error) {
    return false;
  }
}
