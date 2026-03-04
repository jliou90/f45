import { normalizePermissionId } from "./permissionCatalog";

const MOCK_KEY = "kutm.admin.roles.permissions.v1";
const DEV_MODE_FLAG = "KUTM_DEV_MODE";

export type MockRoleRecord = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  created_at: string;
  updated_at: string;
};

type MockRoleStore = {
  schemaVersion: 1;
  byRoleId: Record<string, MockRoleRecord>;
  byRoleName: Record<string, string>;
};

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function defaultStore(): MockRoleStore {
  return { schemaVersion: 1, byRoleId: {}, byRoleName: {} };
}

function readStore(): MockRoleStore {
  if (!canUseWindow()) return defaultStore();
  try {
    const raw = window.localStorage.getItem(MOCK_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw) as Partial<MockRoleStore>;
    if (parsed.schemaVersion !== 1 || !parsed.byRoleId || !parsed.byRoleName) {
      return defaultStore();
    }
    return {
      schemaVersion: 1,
      byRoleId: parsed.byRoleId,
      byRoleName: parsed.byRoleName,
    };
  } catch {
    return defaultStore();
  }
}

function saveStore(store: MockRoleStore): void {
  if (!canUseWindow()) return;
  window.localStorage.setItem(MOCK_KEY, JSON.stringify(store));
}

export function mockRolePermissionsEnabled(): boolean {
  if (!canUseWindow()) return false;
  return window.localStorage.getItem(DEV_MODE_FLAG) === "1";
}

export function upsertMockRole(record: { id: string; name: string; description?: string | null; permissions: string[] }): MockRoleRecord {
  const now = new Date().toISOString();
  const store = readStore();
  const existing = store.byRoleId[record.id];
  const normalizedName = record.name.trim().toLowerCase();
  const next: MockRoleRecord = {
    id: record.id,
    name: record.name,
    description: record.description ?? "",
    permissions: Array.from(new Set(record.permissions.map(normalizePermissionId))).sort((a, b) => a.localeCompare(b)),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  store.byRoleId[record.id] = next;
  store.byRoleName[normalizedName] = record.id;
  saveStore(store);
  return next;
}

export function deleteMockRole(roleId: string): void {
  const store = readStore();
  const existing = store.byRoleId[roleId];
  if (!existing) return;
  delete store.byRoleId[roleId];
  delete store.byRoleName[existing.name.trim().toLowerCase()];
  saveStore(store);
}

export function getMockRole(roleId: string): MockRoleRecord | null {
  const store = readStore();
  return store.byRoleId[roleId] ?? null;
}

export function listMockRoles(): MockRoleRecord[] {
  const store = readStore();
  return Object.values(store.byRoleId).sort((a, b) => a.name.localeCompare(b.name));
}

export function getMockPermissionsForRole(roleName: string | null | undefined): string[] | null {
  const normalizedName = (roleName ?? "").trim().toLowerCase();
  if (!normalizedName) return null;
  const store = readStore();
  const roleId = store.byRoleName[normalizedName];
  if (!roleId) return null;
  return store.byRoleId[roleId]?.permissions ?? null;
}
