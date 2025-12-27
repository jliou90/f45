// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

import { api } from '../client';
import { API_ROUTES } from '@dms/constants';
import type { User, Session } from '@dms/types';

/**
 * Auth API endpoints
 */
export const authEndpoints = {
  /**
   * Login
   */
  login: async (credentials: { username: string; password: string }) => {
    return api.post<{ user: User; accessToken: string; refreshToken: string }>(
      API_ROUTES.AUTH.LOGIN,
      credentials
    );
  },

  /**
   * Logout
   */
  logout: async () => {
    return api.post(API_ROUTES.AUTH.LOGOUT);
  },

  /**
   * Register
   */
  register: async (data: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationId: string;
    role: string;
  }) => {
    return api.post<{ user: User }>(API_ROUTES.AUTH.REGISTER, data);
  },

  /**
   * Refresh token
   */
  refresh: async (refreshToken: string) => {
    return api.post<{ accessToken: string; refreshToken: string }>(
      API_ROUTES.AUTH.REFRESH,
      { refreshToken }
    );
  },

  /**
   * Get current user
   */
  me: async () => {
    return api.get<User>(API_ROUTES.AUTH.ME);
  },

  /**
   * Change password
   */
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    return api.post(API_ROUTES.AUTH.CHANGE_PASSWORD, data);
  },

  /**
   * Forgot password
   */
  forgotPassword: async (email: string) => {
    return api.post(API_ROUTES.AUTH.FORGOT_PASSWORD, { email });
  },

  /**
   * Reset password
   */
  resetPassword: async (data: { token: string; password: string }) => {
    return api.post(API_ROUTES.AUTH.RESET_PASSWORD, data);
  },
};
