import type { ApiError, ConflictError } from "../api/apiTypes";
export type LockState = {
    status: "disabled";
} | {
    status: "acquiring";
} | {
    status: "acquired";
} | {
    status: "blocked";
    by?: string;
} | {
    status: "releasing";
};
export type EditSession<T> = {
    entityType: string;
    entityId: string;
    server?: T;
    etag?: string;
    draft?: T;
    setDraft: (updater: (prev: T) => T) => void;
    isDirty: boolean;
    isLoading: boolean;
    error?: ApiError;
    lock: LockState;
    save: () => Promise<{
        ok: true;
    } | {
        ok: false;
        error: ApiError | ConflictError;
    }>;
    reloadFromServer: () => Promise<void>;
    cancel: () => void;
};
export declare function useEditSession<T>(opts: {
    entityType: string;
    entityId: string;
    lock?: boolean;
}): EditSession<T>;
