import { useEffect, useMemo, useState } from "react";
import type { ApiError, ConflictError } from "../api/apiTypes";
import { apiClient, isConflictError } from "../api/apiClient";
import { useEntity } from "../entities/useEntity";
import { apiLockManager } from "../locks/lockManager";
import { resolveConflict } from "./conflictResolver";

export type LockState =
  | { status: "disabled" }
  | { status: "acquiring" }
  | { status: "acquired" }
  | { status: "blocked"; by?: string }
  | { status: "releasing" };

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
  save: () => Promise<{ ok: true } | { ok: false; error: ApiError | ConflictError }>;
  reloadFromServer: () => Promise<void>;
  cancel: () => void;
};

export function useEditSession<T>(opts: {
  entityType: string;
  entityId: string;
  lock?: boolean;
}): EditSession<T> {
  const { data, etag, isLoading, error, refetch } = useEntity<T>(opts.entityType, opts.entityId);
  const [draft, setDraftState] = useState<T | undefined>();
  const [saveError, setSaveError] = useState<ApiError | undefined>();
  const [lock, setLock] = useState<LockState>({ status: opts.lock ? "acquiring" : "disabled" });

  useEffect(() => {
    setDraftState(data);
  }, [data]);

  useEffect(() => {
    let mounted = true;
    if (!opts.lock) {
      setLock({ status: "disabled" });
      return;
    }

    setLock({ status: "acquiring" });
    void apiLockManager.acquire({ entityType: opts.entityType, entityId: opts.entityId }).then((res) => {
      if (!mounted) {
        return;
      }
      setLock(res.ok ? { status: "acquired" } : { status: "blocked", by: res.by });
    });

    return () => {
      mounted = false;
      setLock({ status: "releasing" });
      void apiLockManager.release({ entityType: opts.entityType, entityId: opts.entityId });
    };
  }, [opts.entityId, opts.entityType, opts.lock]);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(data), [data, draft]);

  async function reloadFromServer() {
    await refetch();
  }

  function cancel() {
    setDraftState(data);
    setSaveError(undefined);
  }

  async function save(): Promise<{ ok: true } | { ok: false; error: ApiError | ConflictError }> {
    if (!draft) {
      const noDraftError: ApiError = {
        kind: "api_error",
        status: 400,
        code: "unknown",
        message: "No draft available"
      };
      return { ok: false, error: noDraftError };
    }

    try {
      const updated = await apiClient.request<T, Partial<T>>({
        method: "PATCH",
        path: `/${opts.entityType}s/${opts.entityId}`,
        body: draft,
        ifMatch: etag
      });
      setDraftState(updated.data);
      setSaveError(undefined);
      await refetch();
      return { ok: true };
    } catch (e) {
      if (isConflictError(e)) {
        const resolution = await resolveConflict({
          entityType: opts.entityType,
          entityId: opts.entityId,
          attemptedIfMatch: etag
        });

        if (resolution.resolution === "reload") {
          await reloadFromServer();
        }

        if (resolution.resolution === "overwrite") {
          try {
            const retried = await apiClient.request<T, Partial<T>>({
              method: "PATCH",
              path: `/${opts.entityType}s/${opts.entityId}`,
              body: draft
            });
            setDraftState(retried.data);
            await refetch();
            return { ok: true };
          } catch (retryError) {
            return { ok: false, error: retryError as ApiError | ConflictError };
          }
        }

        return { ok: false, error: e };
      }

      const apiError = e as ApiError;
      setSaveError(apiError);
      return { ok: false, error: apiError };
    }
  }

  return {
    entityType: opts.entityType,
    entityId: opts.entityId,
    server: data,
    etag,
    draft,
    setDraft: (updater) => {
      setDraftState((prev: T | undefined) => {
        if (!prev) {
          return prev;
        }
        return updater(prev);
      });
    },
    isDirty,
    isLoading,
    error: saveError ?? error,
    lock,
    save,
    reloadFromServer,
    cancel
  };
}
