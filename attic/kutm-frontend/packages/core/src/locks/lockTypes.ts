export type LockRequest = { entityType: string; entityId: string };
export type LockAcquireResult =
  | { ok: true }
  | { ok: false; reason: "busy"; by?: string };

export interface LockManager {
  acquire(req: LockRequest): Promise<LockAcquireResult>;
  release(req: LockRequest): Promise<void>;
}
