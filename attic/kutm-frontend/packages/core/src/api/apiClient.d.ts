import type { ApiClient, ConflictError } from "./apiTypes";
export declare function configureApiClient(config: {
    baseUrl?: string;
}): void;
export declare function isConflictError(e: unknown): e is ConflictError;
export declare const apiClient: ApiClient;
