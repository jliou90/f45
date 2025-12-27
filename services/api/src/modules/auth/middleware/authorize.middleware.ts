// ============================================================================
// AUTHORIZE MIDDLEWARE
// ============================================================================
// Checks user roles and permissions
// Use AFTER authenticate middleware
// ============================================================================

import { Response, NextFunction } from 'express';
import { ApiError } from '@/shared/errors/ApiError';
import { logger } from '@/core/logging/logger';
import { AUTH_ERRORS } from '../constants/auth.constants';
import { ROLE_PERMISSIONS, hasPermission } from '@dms/constants';
import type { AuthRequest } from '../types/auth.types';
import type { UserRole, PermissionResource, PermissionAction } from '@dms/types';

/**
 * Authorize by role
 * Checks if user has one of the allowed roles
 * 
 * Usage:
 *   router.post('/admin', authenticate, authorizeRoles(['admin', 'manager']), controller.method);
 * 
 * @param allowedRoles - Array of allowed roles
 * @returns Express middleware function
 */
export function authorizeRoles(allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      // User must be authenticated first
      if (!req.user) {
        throw ApiError.unauthorized(AUTH_ERRORS.UNAUTHORIZED);
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(req.user.role as UserRole)) {
        logger.warn('Authorization failed - insufficient role', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          path: req.path,
        });

        throw ApiError.forbidden(AUTH_ERRORS.FORBIDDEN);
      }

      logger.debug('Role authorization successful', {
        userId: req.user.id,
        role: req.user.role,
        path: req.path,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Authorize by permission
 * Checks if user has specific permission based on their role
 * 
 * Usage:
 *   router.post('/users', authenticate, authorizePermission('users', 'create'), controller.method);
 * 
 * @param resource - Resource being accessed
 * @param action - Action being performed
 * @returns Express middleware function
 */
export function authorizePermission(
  resource: PermissionResource,
  action: PermissionAction
) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      // User must be authenticated first
      if (!req.user) {
        throw ApiError.unauthorized(AUTH_ERRORS.UNAUTHORIZED);
      }

      // Check if user's role has the required permission
      const hasAccess = hasPermission(
        req.user.role as UserRole,
        resource,
        action
      );

      if (!hasAccess) {
        logger.warn('Authorization failed - insufficient permission', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredPermission: `${resource}:${action}`,
          path: req.path,
        });

        throw ApiError.forbidden(AUTH_ERRORS.FORBIDDEN);
      }

      logger.debug('Permission authorization successful', {
        userId: req.user.id,
        permission: `${resource}:${action}`,
        path: req.path,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Authorize by multiple permissions (user needs ANY of them)
 * 
 * Usage:
 *   router.get('/data', authenticate, authorizeAnyPermission([
 *     { resource: 'reports', action: 'read' },
 *     { resource: 'analytics', action: 'read' }
 *   ]), controller.method);
 * 
 * @param permissions - Array of permission objects
 * @returns Express middleware function
 */
export function authorizeAnyPermission(
  permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized(AUTH_ERRORS.UNAUTHORIZED);
      }

      // Check if user has ANY of the required permissions
      const hasAnyPermission = permissions.some((perm) =>
        hasPermission(req.user!.role as UserRole, perm.resource, perm.action)
      );

      if (!hasAnyPermission) {
        logger.warn('Authorization failed - no matching permissions', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredPermissions: permissions.map(p => `${p.resource}:${p.action}`),
          path: req.path,
        });

        throw ApiError.forbidden(AUTH_ERRORS.FORBIDDEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Authorize by multiple permissions (user needs ALL of them)
 * 
 * Usage:
 *   router.delete('/critical', authenticate, authorizeAllPermissions([
 *     { resource: 'users', action: 'delete' },
 *     { resource: 'audit', action: 'read' }
 *   ]), controller.method);
 * 
 * @param permissions - Array of permission objects
 * @returns Express middleware function
 */
export function authorizeAllPermissions(
  permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized(AUTH_ERRORS.UNAUTHORIZED);
      }

      // Check if user has ALL required permissions
      const hasAllPermissions = permissions.every((perm) =>
        hasPermission(req.user!.role as UserRole, perm.resource, perm.action)
      );

      if (!hasAllPermissions) {
        const missingPermissions = permissions
          .filter(perm => !hasPermission(req.user!.role as UserRole, perm.resource, perm.action))
          .map(p => `${p.resource}:${p.action}`);

        logger.warn('Authorization failed - missing permissions', {
          userId: req.user.id,
          userRole: req.user.role,
          missingPermissions,
          path: req.path,
        });

        throw ApiError.forbidden(AUTH_ERRORS.FORBIDDEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Authorize organization access
 * Ensures user can only access resources from their own organization
 * 
 * Usage:
 *   router.get('/org/:orgId/data', authenticate, authorizeOrganization, controller.method);
 * 
 * Expected params: orgId, organizationId, or organization_id
 */
export function authorizeOrganization(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw ApiError.unauthorized(AUTH_ERRORS.UNAUTHORIZED);
    }

    // Get organization ID from params, query, or body
    const targetOrgId =
      req.params.orgId ||
      req.params.organizationId ||
      req.params.organization_id ||
      req.query.organizationId ||
      req.body?.organizationId;

    if (!targetOrgId) {
      // If no org ID in request, allow (will be set to user's org in controller)
      return next();
    }

    // Check if user is accessing their own organization
    if (targetOrgId !== req.user.organizationId) {
      logger.warn('Authorization failed - organization mismatch', {
        userId: req.user.id,
        userOrgId: req.user.organizationId,
        targetOrgId,
        path: req.path,
      });

      throw ApiError.forbidden('You can only access resources from your own organization');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authorize resource ownership
 * Ensures user can only access/modify their own resources
 * 
 * Usage:
 *   router.put('/profile/:userId', authenticate, authorizeOwnership('userId'), controller.method);
 * 
 * @param userIdParam - Name of the parameter containing the user ID
 * @returns Express middleware function
 */
export function authorizeOwnership(userIdParam: string = 'userId') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized(AUTH_ERRORS.UNAUTHORIZED);
      }

      const targetUserId = req.params[userIdParam] || req.body?.[userIdParam];

      if (!targetUserId) {
        // If no user ID in request, allow (will be handled in controller)
        return next();
      }

      // Check if user is accessing their own resource
      // OR if user is admin/manager (can access anyone's resources)
      const isOwner = targetUserId === req.user.id;
      const isAdmin = ['admin', 'manager'].includes(req.user.role);

      if (!isOwner && !isAdmin) {
        logger.warn('Authorization failed - not resource owner', {
          userId: req.user.id,
          targetUserId,
          path: req.path,
        });

        throw ApiError.forbidden('You can only access your own resources');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Admin only middleware
 * Shorthand for authorizeRoles(['admin'])
 * 
 * Usage:
 *   router.delete('/system', authenticate, adminOnly, controller.method);
 */
export const adminOnly = authorizeRoles(['admin']);

/**
 * Manager or above middleware
 * Allows admin and manager roles
 * 
 * Usage:
 *   router.get('/reports', authenticate, managerOrAbove, controller.method);
 */
export const managerOrAbove = authorizeRoles(['admin', 'manager']);
