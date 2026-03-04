import { ApiClient } from "./api";
import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredTenantId,
  setStoredTokens,
} from "./storage";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";
const API_BASE_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

export const kutmApi = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: getStoredAccessToken,
  getRefreshToken: getStoredRefreshToken,
  setTokens: (accessToken, refreshToken) => setStoredTokens({ accessToken, refreshToken }),
  clearTokens: clearStoredTokens,
  getTenantId: getStoredTenantId,
});

export { API_BASE_ORIGIN, API_BASE_URL };
