import { useSyncExternalStore } from "react";
import type { AdminUser } from "../api";

export type ImpersonationSnapshot = {
  backendEnabled: boolean;
  isImpersonating: boolean;
  originalUser: { id: string; email: string } | null;
  impersonatedUser: { id: string; email: string; displayName?: string | null } | null;
  startedAt: string | null;
};

const initialState: ImpersonationSnapshot = {
  backendEnabled: false,
  isImpersonating: false,
  originalUser: null,
  impersonatedUser: null,
  startedAt: null,
};

let state: ImpersonationSnapshot = initialState;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setState(updater: (current: ImpersonationSnapshot) => ImpersonationSnapshot): void {
  state = updater(state);
  emit();
}

export function subscribeImpersonation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getImpersonationSnapshot(): ImpersonationSnapshot {
  return state;
}

export function useImpersonationState(): ImpersonationSnapshot {
  return useSyncExternalStore(subscribeImpersonation, getImpersonationSnapshot, getImpersonationSnapshot);
}

export function setImpersonationBackendEnabled(enabled: boolean): void {
  setState((current) => ({ ...current, backendEnabled: enabled }));
}

export function startImpersonation(originalUser: { id: string; email: string }, targetUser: AdminUser): void {
  setState((current) => ({
    ...current,
    isImpersonating: true,
    originalUser,
    impersonatedUser: {
      id: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.display_name,
    },
    startedAt: new Date().toISOString(),
  }));
}

export function stopImpersonation(): void {
  setState((current) => ({
    ...current,
    isImpersonating: false,
    impersonatedUser: null,
    startedAt: null,
  }));
}

export function resetImpersonationStore(): void {
  state = initialState;
  emit();
}
