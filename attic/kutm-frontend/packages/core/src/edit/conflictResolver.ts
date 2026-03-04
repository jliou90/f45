import type { ConflictModalPayload, ConflictModalResult } from "./conflictTypes";

type ConflictResolver = (payload: ConflictModalPayload) => Promise<ConflictModalResult | null>;

let resolver: ConflictResolver = async () => ({ resolution: "cancel" });

export function registerConflictResolver(next: ConflictResolver) {
  resolver = next;
}

export async function resolveConflict(payload: ConflictModalPayload): Promise<ConflictModalResult> {
  const result = await resolver(payload);
  return result ?? { resolution: "cancel" };
}
