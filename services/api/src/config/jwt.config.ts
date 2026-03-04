// ============================================================================
// JWT CONFIGURATION
// ============================================================================

import { SignOptions } from 'jsonwebtoken';
import { config } from './app.config';

/**
 * JWT sign options for access tokens
 */
export const accessTokenOptions: SignOptions = {
  expiresIn: config.jwt.expiresIn,
  issuer: 'dms-api',
  audience: 'dms-web',
};

/**
 * JWT sign options for refresh tokens
 */
export const refreshTokenOptions: SignOptions = {
  expiresIn: config.jwt.refreshExpiresIn,
  issuer: 'dms-api',
  audience: 'dms-web',
};

/**
 * JWT payload interface
 */
export interface JwtPayload {
  userId: string;
  organizationId: string;
  role: string;
  type: 'access' | 'refresh';
}
