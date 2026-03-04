export declare const queryKeys: {
    entity: (tenantId: string | undefined, entityType: string, id: string) => readonly ["entity", string, string, string];
    audit: (tenantId: string | undefined, entityType: string, id: string) => readonly ["audit", string, string, string];
};
