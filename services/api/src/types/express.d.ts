// ============================================================================
// EXPRESS TYPE EXTENSIONS
// ============================================================================
// Extends Express types to include authenticated user
// Provides type safety for req.user throughout the application
// ============================================================================

import { AuthenticatedUser } from '../modules/auth/types/auth.types';

declare global {
  namespace Express {
    /**
     * Extended Express Request interface
     * Adds user and token properties for authenticated requests
     */
    interface Request {
      /**
       * Authenticated user data (populated by authenticate middleware)
       */
      user?: AuthenticatedUser;

      /**
       * JWT token (populated by authenticate middleware)
       */
      token?: string;
    }
  }
}

// This export is required to make this a module
export {};
