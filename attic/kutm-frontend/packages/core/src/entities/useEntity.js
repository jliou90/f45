import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import { getTenantId } from "../auth/tenantStore";
import { queryKeys } from "./queryKeys";
export function useEntity(entityType, id) {
    const tenantId = getTenantId();
    const query = useQuery({
        queryKey: queryKeys.entity(tenantId, entityType, id),
        queryFn: async () => {
            const resp = await apiClient.request({
                method: "GET",
                path: `/${entityType}s/${id}`
            });
            return resp;
        }
    });
    return {
        data: query.data?.data,
        etag: query.data?.etag,
        isLoading: query.isLoading,
        error: query.error ?? undefined,
        refetch: query.refetch
    };
}
