import { currentTenant, tenantsMine, type TenantMembership } from "./auth";
import {
  clearStoredTenantId,
  clearStoredTenantName,
  getStoredTenantId,
  getStoredTenantName,
  setStoredTenantId,
  setStoredTenantName,
} from "./storage";

export function getPersistedTenant(): { id: string | null; name: string | null } {
  return {
    id: getStoredTenantId(),
    name: getStoredTenantName(),
  };
}

export function persistTenant(tenant: TenantMembership): void {
  setStoredTenantId(tenant.id);
  setStoredTenantName(tenant.name);
}

export function clearPersistedTenant(): void {
  clearStoredTenantId();
  clearStoredTenantName();
}

export { currentTenant, tenantsMine };
