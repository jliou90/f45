import { apiClient } from "../api/apiClient";
import type { LockAcquireResult, LockManager, LockRequest } from "./lockTypes";

export const noopLockManager: LockManager = {
  async acquire() {
    return { ok: true };
  },
  async release() {
    return;
  }
};

export const apiLockManager: LockManager = {
  async acquire(req: LockRequest): Promise<LockAcquireResult> {
    const resp = await apiClient.request<{ ok: boolean; by?: string }>({
      method: "POST",
      path: "/locks/acquire",
      body: req
    });

    if (resp.data.ok) {
      return { ok: true };
    }
    return { ok: false, reason: "busy", by: resp.data.by };
  },
  async release(req: LockRequest) {
    await apiClient.request({ method: "POST", path: "/locks/release", body: req });
  }
};
