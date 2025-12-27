// ============================================================================
// AUTH REPOSITORY
// ============================================================================
// Repository pattern: Encapsulates all database access logic
// Benefits: 
// - Separation of concerns (service doesn't know about DB)
// - Easy to mock for testing
// - Can swap DB implementations
// - Centralized query logic
// ============================================================================

import { prisma } from '@/core/database/client';
import { Prisma } from '@prisma/client';
import { logger } from '@/core/logging/logger';

/**
 * User repository
 * Handles all database operations for users
 */
export class UserRepository {
  /**
   * Find user by ID
   */
  async findById(id: string) {
    try {
      return await prisma.user.findUnique({
        where: { id },
        include: {
          organization: true,
          location: true,
        },
      });
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string) {
    try {
      return await prisma.user.findUnique({
        where: { username },
        include: {
          organization: true,
          location: true,
        },
      });
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    try {
      return await prisma.user.findUnique({
        where: { email },
        include: {
          organization: true,
          location: true,
        },
      });
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Create new user
   */
  async create(data: Prisma.UserCreateInput) {
    try {
      return await prisma.user.create({
        data,
        include: {
          organization: true,
          location: true,
        },
      });
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async update(id: string, data: Prisma.UserUpdateInput) {
    try {
      return await prisma.user.update({
        where: { id },
        data,
        include: {
          organization: true,
          location: true,
        },
      });
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, hashedPassword: string) {
    try {
      return await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string) {
    try {
      return await prisma.user.update({
        where: { id },
        data: { lastLoginAt: new Date() },
      });
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(id: string) {
    try {
      return await prisma.user.update({
        where: { id },
        data: { emailVerified: true },
      });
    } catch (error) {
      logger.error('Error verifying email:', error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete by marking inactive)
   */
  async delete(id: string) {
    try {
      return await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Check if username exists
   */
  async usernameExists(username: string): Promise<boolean> {
    try {
      const count = await prisma.user.count({
        where: { username },
      });
      return count > 0;
    } catch (error) {
      logger.error('Error checking username:', error);
      throw error;
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      const count = await prisma.user.count({
        where: { email },
      });
      return count > 0;
    } catch (error) {
      logger.error('Error checking email:', error);
      throw error;
    }
  }
}

/**
 * Session repository
 * Handles all database operations for sessions
 */
export class SessionRepository {
  /**
   * Create new session
   */
  async create(data: Prisma.SessionCreateInput) {
    try {
      return await prisma.session.create({ data });
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Find session by token
   */
  async findByToken(token: string) {
    try {
      return await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });
    } catch (error) {
      logger.error('Error finding session:', error);
      throw error;
    }
  }

  /**
   * Find all sessions for user
   */
  async findByUserId(userId: string) {
    try {
      return await prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error finding user sessions:', error);
      throw error;
    }
  }

  /**
   * Delete session
   */
  async delete(id: string) {
    try {
      return await prisma.session.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Delete all sessions for user
   */
  async deleteByUserId(userId: string) {
    try {
      return await prisma.session.deleteMany({
        where: { userId },
      });
    } catch (error) {
      logger.error('Error deleting user sessions:', error);
      throw error;
    }
  }

  /**
   * Delete expired sessions
   */
  async deleteExpired() {
    try {
      return await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
    } catch (error) {
      logger.error('Error deleting expired sessions:', error);
      throw error;
    }
  }
}

/**
 * Refresh Token repository
 * Handles all database operations for refresh tokens
 */
export class RefreshTokenRepository {
  /**
   * Create new refresh token
   */
  async create(data: Prisma.RefreshTokenCreateInput) {
    try {
      return await prisma.refreshToken.create({ data });
    } catch (error) {
      logger.error('Error creating refresh token:', error);
      throw error;
    }
  }

  /**
   * Find refresh token by token value
   */
  async findByToken(token: string) {
    try {
      return await prisma.refreshToken.findUnique({
        where: { token },
        include: { user: true },
      });
    } catch (error) {
      logger.error('Error finding refresh token:', error);
      throw error;
    }
  }

  /**
   * Revoke refresh token
   */
  async revoke(id: string) {
    try {
      return await prisma.refreshToken.update({
        where: { id },
        data: { isRevoked: true },
      });
    } catch (error) {
      logger.error('Error revoking refresh token:', error);
      throw error;
    }
  }

  /**
   * Revoke all refresh tokens for user
   */
  async revokeByUserId(userId: string) {
    try {
      return await prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    } catch (error) {
      logger.error('Error revoking user refresh tokens:', error);
      throw error;
    }
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired() {
    try {
      return await prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isRevoked: true },
          ],
        },
      });
    } catch (error) {
      logger.error('Error deleting expired refresh tokens:', error);
      throw error;
    }
  }

  /**
   * Count active tokens for user
   */
  async countActiveByUserId(userId: string): Promise<number> {
    try {
      return await prisma.refreshToken.count({
        where: {
          userId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      });
    } catch (error) {
      logger.error('Error counting active refresh tokens:', error);
      throw error;
    }
  }
}

/**
 * Export repository instances
 */
export const userRepository = new UserRepository();
export const sessionRepository = new SessionRepository();
export const refreshTokenRepository = new RefreshTokenRepository();
