import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import { getTenantId } from "../auth/tenantStore";
import { queryKeys } from "../entities/queryKeys";
import type { AuditResponse } from "./auditTypes";

export function useAudit(entityType: string, entityId: string) {
  const tenantId = getTenantId();
  return useQuery({
    queryKey: queryKeys.audit(tenantId, entityType, entityId),
    queryFn: async () => {
      const resp = await apiClient.request<AuditResponse>({
        method: "GET",
        path: `/${entityType}s/${entityId}/audit`
      });
      return resp.data;
    }
  });
}
