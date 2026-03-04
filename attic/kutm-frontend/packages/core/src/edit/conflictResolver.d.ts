import type { ConflictModalPayload, ConflictModalResult } from "./conflictTypes";
type ConflictResolver = (payload: ConflictModalPayload) => Promise<ConflictModalResult | null>;
export declare function registerConflictResolver(next: ConflictResolver): void;
export declare function resolveConflict(payload: ConflictModalPayload): Promise<ConflictModalResult>;
export {};
