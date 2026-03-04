import type { ReactNode } from "react";

export function Toast({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return <div className={`toast ${tone}`}>{children}</div>;
}
