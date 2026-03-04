import type { ApiError } from "../api/apiTypes";
export type EntityFetchResult<T> = {
    data?: T;
    etag?: string;
    isLoading: boolean;
    error?: ApiError;
    refetch: () => Promise<unknown>;
};
export declare function useEntity<T>(entityType: string, id: string): EntityFetchResult<T>;
