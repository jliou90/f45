import type React from "react";
import type { z } from "zod";

export type ModalKey = string;

export type ModalComponentProps<P, R> = {
  payload: P;
  close: (result: R | null) => void;
};

export type ModalSpec<P, R> = {
  key: ModalKey;
  kind: "modal" | "drawer";
  payloadSchema: z.ZodType<P>;
  Component: React.ComponentType<ModalComponentProps<P, R>>;
  requiredPermissions?: string[];
};

export type ModalRegistry = Record<ModalKey, ModalSpec<any, any>>;

export type ModalMap = {
  "customer.picker": {
    payload: { initialQuery?: string };
    result: { customerId: string; label: string };
  };
  "customer.edit": {
    payload: { customerId: string };
    result: { customerId: string; changed: boolean };
  };
  "platform.conflict": {
    payload: { entityType: string; entityId: string; attemptedIfMatch?: string };
    result: { resolution: "reload" | "overwrite" | "cancel" };
  };
};
