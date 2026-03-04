import type { PropsWithChildren } from "react";

export function Badge({ children, tone = "neutral" }: PropsWithChildren<{ tone?: "neutral" | "ok" | "warn" | "danger" }>) {
  const className = tone === "ok" ? "badge ok" : tone === "warn" ? "badge warn" : tone === "danger" ? "badge danger" : "badge neutral";
  return <span className={className}>{children}</span>;
}
