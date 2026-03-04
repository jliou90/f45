import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import { getTenantId } from "../auth/tenantStore";
import { queryKeys } from "../entities/queryKeys";
export function useAudit(entityType, entityId) {
    const tenantId = getTenantId();
    return useQuery({
        queryKey: queryKeys.audit(tenantId, entityType, entityId),
        queryFn: async () => {
            const resp = await apiClient.request({
                method: "GET",
                path: `/${entityType}s/${entityId}/audit`
            });
            return resp.data;
        }
    });
}
