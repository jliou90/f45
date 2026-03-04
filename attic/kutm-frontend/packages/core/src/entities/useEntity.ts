import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import type { ApiError } from "../api/apiTypes";
import { getTenantId } from "../auth/tenantStore";
import { queryKeys } from "./queryKeys";

export type EntityFetchResult<T> = {
  data?: T;
  etag?: string;
  isLoading: boolean;
  error?: ApiError;
  refetch: () => Promise<unknown>;
};

export function useEntity<T>(entityType: string, id: string): EntityFetchResult<T> {
  const tenantId = getTenantId();
  const query = useQuery({
    queryKey: queryKeys.entity(tenantId, entityType, id),
    queryFn: async () => {
      const resp = await apiClient.request<T>({
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
    error: (query.error as unknown as ApiError | null) ?? undefined,
    refetch: query.refetch
  };
}
