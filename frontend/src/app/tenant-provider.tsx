import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { TenantMembership } from "../lib/auth";
import { setTenantBranding } from "../lib/branding";
import { publishWindowSync, subscribeWindowSync } from "../lib/window-sync";
import { currentTenant, tenantsMine } from "../lib/tenant";
import { clearPersistedTenant, getPersistedTenant, persistTenant } from "../lib/tenant";
import { getStoredAccessToken } from "../lib/storage";
import { TenantContext, type TenantContextValue } from "./tenant-state";

type BootstrapState = TenantContextValue["bootstrapState"];

function roleRank(role: string | null | undefined): number {
  const normalized = (role ?? "").toUpperCase();
  if (normalized === "ADMIN") return 3;
  if (normalized === "MANAGER") return 2;
  if (normalized === "USER") return 1;
  return 0;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const persisted = getPersistedTenant();
  const [tenants, setTenants] = useState<TenantMembership[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(persisted.id);
  const [tenantName, setTenantName] = useState<string | null>(persisted.name);
  const [currentTenantState, setCurrentTenantState] = useState<TenantMembership | null>(null);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>("idle");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const selectTenant = useCallback(async (tenant: TenantMembership) => {
    persistTenant(tenant);
    setTenantId(tenant.id);
    setTenantName(tenant.name);
    setBootstrapError(null);
    publishWindowSync({ type: "TENANT_CHANGED", payload: { tenantId: tenant.id, tenantName: tenant.name } });
    const confirmedTenant = await currentTenant();
    setCurrentTenantState(confirmedTenant);
    setTenantName(confirmedTenant.name);
    setTenantBranding(confirmedTenant.id, confirmedTenant, true);
    setBootstrapState("ready");
  }, []);

  const refreshCurrentTenant = useCallback(async () => {
    if (!tenantId) {
      setCurrentTenantState(null);
      return;
    }
    const tenant = await currentTenant();
    setCurrentTenantState(tenant);
    setTenantName(tenant.name);
    setTenantBranding(tenant.id, tenant, true);
  }, [tenantId]);

  const loadTenants = useCallback(async (): Promise<BootstrapState> => {
    setIsLoadingTenants(true);
    setBootstrapState("loading");
    setBootstrapError(null);

    try {
      const result = await tenantsMine();
      const items = result.items ?? [];
      setTenants(items);

      if (items.length === 0) {
        clearPersistedTenant();
        setTenantId(null);
        setTenantName(null);
        setCurrentTenantState(null);
        setBootstrapState("empty");
        return "empty";
      }

      const selected = tenantId ? items.find((item) => item.id === tenantId) : null;
      if (selected) {
        setBootstrapState("ready");
        return "ready";
      }

      const persistedSelection = persisted.id ? items.find((item) => item.id === persisted.id) : null;
      if (persistedSelection) {
        await selectTenant(persistedSelection);
        return "ready";
      }

      if (items.length === 1) {
        await selectTenant(items[0]);
        return "ready";
      }

      setTenantId(null);
      setTenantName(null);
      setCurrentTenantState(null);
      setBootstrapState("needs_selection");
      return "needs_selection";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load tenant memberships";
      setBootstrapError(message);
      setBootstrapState("error");
      throw error;
    } finally {
      setIsLoadingTenants(false);
    }
  }, [persisted.id, selectTenant, tenantId]);

  const clearTenant = useCallback(() => {
    clearPersistedTenant();
    setTenantId(null);
    setTenantName(null);
    setCurrentTenantState(null);
    setBootstrapState("idle");
    setBootstrapError(null);
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    void refreshCurrentTenant();
  }, [tenantId, refreshCurrentTenant]);

  useEffect(() => {
    return subscribeWindowSync((event) => {
      if (event.type !== "TENANT_CHANGED") return;
      const nextTenantId = event.payload?.tenantId;
      const nextTenantName = event.payload?.tenantName;
      if (typeof nextTenantId !== "string") return;
      setTenantId(nextTenantId);
      if (typeof nextTenantName === "string") {
        setTenantName(nextTenantName);
      }
      setBootstrapState("ready");
      void refreshCurrentTenant();
    });
  }, [refreshCurrentTenant]);

  useEffect(() => {
    return subscribeWindowSync((event) => {
      if (event.type === "LOGOUT") {
        clearTenant();
      }
    });
  }, [clearTenant]);

  useEffect(() => {
    if (!getStoredAccessToken()) return;
    if (tenants.length > 0) return;
    void loadTenants();
  }, [tenants.length, loadTenants]);

  const currentRoleFromTenant = currentTenantState?.role ?? (tenantId ? (tenants.find((item) => item.id === tenantId)?.role ?? null) : null);
  const highestKnownRole =
    tenants
      .map((item) => item.role)
      .sort((a, b) => roleRank(b) - roleRank(a))
      .at(0) ?? null;
  const currentRole = currentRoleFromTenant ?? highestKnownRole;

  const value = useMemo<TenantContextValue>(
    () => ({
      tenants,
      tenantId,
      tenantName,
      currentRole,
      currentTenant: currentTenantState,
      isLoadingTenants,
      bootstrapState,
      bootstrapError,
      loadTenants,
      selectTenant,
      refreshCurrentTenant,
      clearTenant,
    }),
    [
      tenants,
      tenantId,
      tenantName,
      currentRole,
      currentTenantState,
      isLoadingTenants,
      bootstrapState,
      bootstrapError,
      loadTenants,
      selectTenant,
      refreshCurrentTenant,
      clearTenant,
    ],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
