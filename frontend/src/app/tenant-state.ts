import { createContext } from "react";
import type { TenantMembership } from "../lib/auth";

export type TenantContextValue = {
  tenants: TenantMembership[];
  tenantId: string | null;
  tenantName: string | null;
  currentRole: string | null;
  currentTenant: TenantMembership | null;
  isLoadingTenants: boolean;
  bootstrapState: "idle" | "loading" | "ready" | "needs_selection" | "empty" | "error";
  bootstrapError: string | null;
  loadTenants: () => Promise<TenantContextValue["bootstrapState"]>;
  selectTenant: (tenant: TenantMembership) => Promise<void>;
  refreshCurrentTenant: () => Promise<void>;
  clearTenant: () => void;
};

export const TenantContext = createContext<TenantContextValue | null>(null);
