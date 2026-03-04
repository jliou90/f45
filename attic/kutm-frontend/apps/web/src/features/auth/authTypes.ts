export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
};

export type MeResponse = {
  user: { id: string; name: string };
  tenants: Array<{ id: string; name: string }>;
  defaultApps: string[];
  permissions: string[];
};
