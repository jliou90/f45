import { createContext } from "react";

type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
};

export type ToastContextValue = {
  toasts: ToastItem[];
  pushToast: (kind: ToastKind, message: string) => void;
  removeToast: (id: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

