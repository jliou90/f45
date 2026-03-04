import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ToastContext, type ToastContextValue, type ToastItem } from "./toast-state";

const TOAST_COOLDOWN_MS = 5000;
const MAX_TOASTS = 6;

function newToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastShownByKeyRef = useRef<Record<string, number>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (kind: ToastItem["kind"], message: string) => {
      const key = `${kind}:${message.trim().toLowerCase()}`;
      const now = Date.now();
      const lastShownAt = lastShownByKeyRef.current[key] ?? 0;
      if (now - lastShownAt < TOAST_COOLDOWN_MS) {
        return;
      }
      lastShownByKeyRef.current[key] = now;

      const id = newToastId();
      setToasts((current) => [...current, { id, kind, message }].slice(-MAX_TOASTS));
      setTimeout(() => removeToast(id), 3500);
    },
    [removeToast],
  );

  const value = useMemo<ToastContextValue>(() => ({ toasts, pushToast, removeToast }), [toasts, pushToast, removeToast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
