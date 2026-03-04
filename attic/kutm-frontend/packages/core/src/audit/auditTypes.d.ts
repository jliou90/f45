export type AuditEvent = {
    ts: string;
    actor: string;
    action: string;
    diff: unknown;
};
export type AuditResponse = {
    events: AuditEvent[];
};
