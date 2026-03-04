export const queryKeys = {
    entity: (tenantId, entityType, id) => ["entity", tenantId ?? "UNSPECIFIED_NO_TENANT", entityType, id],
    audit: (tenantId, entityType, id) => ["audit", tenantId ?? "UNSPECIFIED_NO_TENANT", entityType, id]
};
