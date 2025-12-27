// ============================================================================
// API CLIENT - Configuration
// ============================================================================

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from '@dms/types';
import { API_CONFIG, AUTH_CONFIG } from '@dms/constants';

/**
 * API Client configuration
 */
export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Create configured Axios instance
 */
export function createApiClient(config?: ApiClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config?.baseURL || API_CONFIG.BASE_URL,
    timeout: config?.timeout || API_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      ...config?.headers,
    },
  });

  // Request interceptor - Add auth token
  client.interceptors.request.use(
    (config) => {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - Handle errors
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Handle 401 - Try to refresh token
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = getRefreshToken();
          if (refreshToken) {
            const { data } = await axios.post(
              `${API_CONFIG.BASE_URL}/api/v1/auth/refresh`,
              { refreshToken }
            );

            setAccessToken(data.accessToken);
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

            return client(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed - Clear tokens and redirect to login
          clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Default API client instance
 */
export const apiClient = createApiClient();

/**
 * Token management functions
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_CONFIG.REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_CONFIG.REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  localStorage.removeItem(AUTH_CONFIG.REFRESH_TOKEN_KEY);
}

/**
 * Generic API request wrapper
 */
export async function apiRequest<T = any>(
  config: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response: AxiosResponse<ApiResponse<T>> = await apiClient.request(config);
    return response.data;
  } catch (error: any) {
    // Handle axios error
    if (error.response) {
      return error.response.data;
    }

    // Network error or other
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network error occurred',
      },
    };
  }
}

/**
 * Convenience methods
 */
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: 'GET', url, ...config }),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: 'POST', url, data, ...config }),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: 'PUT', url, data, ...config }),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: 'PATCH', url, data, ...config }),

  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: 'DELETE', url, ...config }),
};
