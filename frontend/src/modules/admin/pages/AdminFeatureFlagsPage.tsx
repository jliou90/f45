import { useMemo, useState } from "react";
import { useFeatureFlag } from "../../../app/use-feature-flag";
import { useTenant } from "../../../app/use-tenant";
import { publishWindowSync } from "../../../lib/window-sync";
import { ApiError } from "../../../lib/api";
import { useQuery } from "../../../lib/query";
import { Button, Input, Select } from "../../../ui";
import {
  adminFeatureFlagCatalog,
  adminFeatureFlagEffective,
  adminFeatureFlagOverrides,
  adminDeleteFeatureFlagOverride,
  adminListRoles,
  adminUpsertFeatureFlagOverride,
} from "../api";

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

export function AdminFeatureFlagsPage() {
  const tenant = useTenant();
  const readOnly = Boolean(useFeatureFlag("admin.readOnly", false));
  const [tab, setTab] = useState<"tenant" | "role">("tenant");
  const [previewRoleId, setPreviewRoleId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiError | null>(null);

  const catalogQuery = useQuery(() => adminFeatureFlagCatalog(), { deps: [] });
  const overridesQuery = useQuery(() => adminFeatureFlagOverrides(), { deps: [] });
  const rolesQuery = useQuery(() => adminListRoles({ page: 1, size: 100 }), { deps: [] });
  const effectiveQuery = useQuery(() => adminFeatureFlagEffective({ role_id: previewRoleId || undefined }), { deps: [previewRoleId] });

  const overrideMap = useMemo(() => {
    const out = new Map<string, { value: unknown; scope: "tenant" | "role"; role_id?: string }>();
    if (tab === "tenant") {
      for (const item of overridesQuery.data?.tenant ?? []) {
        out.set(item.flag_key, { value: item.value, scope: "tenant" });
      }
    } else {
      for (const item of overridesQuery.data?.role ?? []) {
        if (!previewRoleId || item.role_id !== previewRoleId) continue;
        out.set(item.flag_key, { value: item.value, scope: "role", role_id: item.role_id });
      }
    }
    return out;
  }, [overridesQuery.data, tab, previewRoleId]);

  const onSave = async (flagKey: string) => {
    const raw = drafts[flagKey] ?? "";
    setError(null);
    try {
      const scope = tab;
      await adminUpsertFeatureFlagOverride(flagKey, {
        scope,
        role_id: scope === "role" ? previewRoleId : undefined,
        value: parseValue(raw),
      });
      await overridesQuery.refetch();
      await effectiveQuery.refetch();
      publishWindowSync({ type: "FEATURE_FLAGS_UPDATED", payload: { tenantId: tenant.tenantId } });
    } catch (err) {
      setError(err as ApiError);
    }
  };

  const onDelete = async (flagKey: string) => {
    setError(null);
    try {
      await adminDeleteFeatureFlagOverride(flagKey, { scope: tab, role_id: tab === "role" ? previewRoleId : undefined });
      await overridesQuery.refetch();
      await effectiveQuery.refetch();
      publishWindowSync({ type: "FEATURE_FLAGS_UPDATED", payload: { tenantId: tenant.tenantId } });
    } catch (err) {
      setError(err as ApiError);
    }
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Admin / Feature Flags</div>
        <h1>Feature Flags</h1>
        <div className="row">
          <Button type="button" variant={tab === "tenant" ? "primary" : "secondary"} onClick={() => setTab("tenant")}>Tenant Overrides</Button>
          <Button type="button" variant={tab === "role" ? "primary" : "secondary"} onClick={() => setTab("role")}>Role Overrides</Button>
          {tab === "role" ? (
            <Select value={previewRoleId} onChange={(event) => setPreviewRoleId(event.target.value)}>
              <option value="">Select role</option>
              {(rolesQuery.data?.items ?? []).map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </Select>
          ) : null}
        </div>
      </div>

      {error ? <div className="panel"><p className="muted">{error.message} (request_id: {error.request_id ?? "n/a"})</p></div> : null}

      <div className="panel">
        <h3>Catalog</h3>
        <table className="dataTable">
          <thead>
            <tr>
              <th>Flag</th>
              <th>Description</th>
              <th>Default</th>
              <th>Override</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(catalogQuery.data?.items ?? []).map((flag) => {
              const existing = overrideMap.get(flag.key);
              const draft = drafts[flag.key] ?? stringifyValue(existing?.value ?? flag.default_value);
              return (
                <tr key={flag.key}>
                  <td>{flag.key}</td>
                  <td>{flag.description}</td>
                  <td><code>{stringifyValue(flag.default_value)}</code></td>
                  <td>
                    <Input
                      value={draft}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [flag.key]: event.target.value }))}
                    />
                  </td>
                  <td>
                    <div className="row">
                      <Button type="button" onClick={() => void onSave(flag.key)} disabled={readOnly || (tab === "role" && !previewRoleId)}>Save</Button>
                      <Button type="button" variant="secondary" onClick={() => void onDelete(flag.key)} disabled={readOnly || !existing}>Clear</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Effective Preview</h3>
        <p className="muted">Resolved order: user override, role override, tenant override, default.</p>
        <pre>{JSON.stringify(effectiveQuery.data?.flags ?? {}, null, 2)}</pre>
      </div>
    </div>
  );
}
