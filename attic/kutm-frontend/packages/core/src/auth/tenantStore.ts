let tenantId: string | undefined;

export function getTenantId() {
  return tenantId;
}

export function setTenantId(next: string | undefined) {
  tenantId = next;
}
