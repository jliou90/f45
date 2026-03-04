export const queryKeys = {
  entity: (tenantId: string | undefined, entityType: string, id: string) =>
    ["entity", tenantId ?? "UNSPECIFIED_NO_TENANT", entityType, id] as const,
  audit: (tenantId: string | undefined, entityType: string, id: string) =>
    ["audit", tenantId ?? "UNSPECIFIED_NO_TENANT", entityType, id] as const
};
