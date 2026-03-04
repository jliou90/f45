// ============================================================================
// AUTH SERVICE
// ============================================================================

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '@/core/database/client';
import { config } from '@/config/app.config';
import { ApiError } from '@/shared/errors/ApiError';
import type { LoginInput, RegisterInput } from '@dms/validation';

/**
 * Auth Service
 */
export const authService = {
  /**
   * Login user
   */
  async login(data: LoginInput) {
    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username: data.username },
      include: {
        organization: true,
        location: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw ApiError.forbidden('Account is inactive');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.password);
    if (!isValidPassword) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  },

  /**
   * Register new user
   */
  async register(data: RegisterInput) {
    // Check if username exists
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      throw ApiError.conflict('Username already exists');
    }

    // Check if email exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw ApiError.conflict('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      include: {
        organization: true,
        location: true,
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword };
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        location: true,
      },
    });

    if (!user) {
      throw ApiError.notFound('User');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  /**
   * Logout user
   */
  async logout(userId: string) {
    // Revoke all refresh tokens for user
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  },

  /**
   * Refresh access token
   */
  async refreshToken(token: string) {
    // Verify token
    let payload: any;
    try {
      payload = jwt.verify(token, config.jwt.refreshSecret);
    } catch (error) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Check if token exists and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.isRevoked) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      throw ApiError.unauthorized('Refresh token expired');
    }

    // Generate new tokens
    const accessToken = this.generateAccessToken(storedToken.user);
    const newRefreshToken = this.generateRefreshToken(storedToken.user);

    // Revoke old refresh token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Create new refresh token
    await prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  },

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  },

  /**
   * Generate access token
   */
  generateAccessToken(user: any): string {
    return jwt.sign(
      {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        type: 'access',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  },

  /**
   * Generate refresh token
   */
  generateRefreshToken(user: any): string {
    return jwt.sign(
      {
        userId: user.id,
        organizationId: user.organizationId,
        type: 'refresh',
      },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  },
};
