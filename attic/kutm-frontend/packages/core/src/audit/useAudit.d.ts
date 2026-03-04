import type { AuditResponse } from "./auditTypes";
export declare function useAudit(entityType: string, entityId: string): import("@tanstack/react-query").UseQueryResult<AuditResponse, Error>;
