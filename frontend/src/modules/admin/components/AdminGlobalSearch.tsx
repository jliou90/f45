import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFeatureFlags } from "../../../app/use-feature-flags";
import { useTenant } from "../../../app/use-tenant";
import { useQuery } from "../../../lib/query";
import { getPlugins } from "../../../plugins/registry";
import { Button, Input } from "../../../ui";
import { adminListAudit, adminListRoles, adminListUsers, type AdminAuditEvent, type AdminRole, type AdminUser } from "../api";

type SearchGroup = "Users" | "Roles" | "Audit" | "Modules" | "Tenants";

type SearchResult = {
  id: string;
  group: SearchGroup;
  label: string;
  detail: string;
  to: string;
};

function useDebouncedValue(value: string, waitMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), waitMs);
    return () => window.clearTimeout(handle);
  }, [value, waitMs]);
  return debounced;
}

function userResult(user: AdminUser): SearchResult {
  return {
    id: `user:${user.id}`,
    group: "Users",
    label: user.display_name || user.email,
    detail: user.email,
    to: `/admin/users?focus=${encodeURIComponent(user.id)}`,
  };
}

function roleResult(role: AdminRole): SearchResult {
  return {
    id: `role:${role.id}`,
    group: "Roles",
    label: role.name,
    detail: `${role.permission_count} permissions`,
    to: `/admin/roles?focus=${encodeURIComponent(role.id)}`,
  };
}

function auditResult(event: AdminAuditEvent): SearchResult {
  return {
    id: `audit:${event.id}`,
    group: "Audit",
    label: `${event.action} ${event.target_type}:${event.target_id}`,
    detail: event.actor_email || event.actor_user_id || "system",
    to: `/admin/audit?focus=${encodeURIComponent(event.id)}`,
  };
}

export function AdminGlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const tenant = useTenant();
  const featureFlags = useFeatureFlags();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setQuery("");
        setSelectedIndex(0);
      });
    }
  }, [open]);

  const fetchSearchResults = useCallback(async () => {
    const q = debouncedQuery;
    if (!open || q.length < 2) {
      return [] as SearchResult[];
    }

    const normalized = q.toLowerCase();
    const [users, roles, audits] = await Promise.all([
      adminListUsers({ page: 1, size: 25, query: q }).catch(() => ({ items: [], meta: { page: 1, size: 25, total: 0 } })),
      adminListRoles({ page: 1, size: 25, query: q }).catch(() => ({ items: [], meta: { page: 1, size: 25, total: 0 } })),
      adminListAudit({ page: 1, size: 25, actor: q }).catch(() => ({ items: [], meta: { page: 1, size: 25, total: 0 } })),
    ]);

    const moduleResults: SearchResult[] = getPlugins({
      featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
      isDev: import.meta.env.DEV,
    })
      .filter((plugin) => {
        const haystack = `${plugin.name} ${plugin.description} ${plugin.keywords.join(" ")}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 5)
      .map((plugin) => ({
        id: `module:${plugin.id}`,
        group: "Modules",
        label: plugin.name,
        detail: plugin.routeBase,
        to: plugin.routeBase,
      }));

    const tenantResults: SearchResult[] = tenant.tenants
      .filter((item) => `${item.id} ${item.name}`.toLowerCase().includes(normalized))
      .slice(0, 5)
      .map((item) => ({
        id: `tenant:${item.id}`,
        group: "Tenants",
        label: item.name,
        detail: `Role: ${item.role}`,
        to: "/tenant-picker",
      }));

    return [
      ...users.items.slice(0, 5).map(userResult),
      ...roles.items.slice(0, 5).map(roleResult),
      ...audits.items.slice(0, 5).map(auditResult),
      ...moduleResults,
      ...tenantResults,
    ];
  }, [debouncedQuery, open, tenant.tenants, featureFlags.flags]);

  const searchQuery = useQuery(fetchSearchResults, {
    enabled: open,
    deps: [open, debouncedQuery],
  });

  const grouped = useMemo(() => {
    const map = new Map<SearchGroup, SearchResult[]>();
    for (const result of searchQuery.data ?? []) {
      const list = map.get(result.group) ?? [];
      list.push(result);
      map.set(result.group, list);
    }
    return map;
  }, [searchQuery.data]);

  const flat = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && location.pathname.startsWith("/admin")) {
        event.preventDefault();
        event.stopPropagation();
        if (!open) {
          return;
        }
      }
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (flat.length === 0 ? 0 : (prev + 1) % flat.length));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (flat.length === 0 ? 0 : (prev - 1 + flat.length) % flat.length));
      }
      if (event.key === "Enter") {
        const selected = flat[selectedIndex];
        if (!selected) return;
        event.preventDefault();
        navigate(selected.to);
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [flat, navigate, onClose, open, selectedIndex, location.pathname]);

  useEffect(() => {
    const onScopedShortcut = (event: KeyboardEvent) => {
      if (!location.pathname.startsWith("/admin")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onScopedShortcut, true);
    return () => {
      window.removeEventListener("keydown", onScopedShortcut, true);
    };
  }, [location.pathname]);

  if (!open) return null;

  let offset = 0;

  return (
    <div className="paletteOverlay" onClick={onClose}>
      <div className="palette" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Admin Global Search">
        <div className="sectionHeader">
          <h3>Search Admin</h3>
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        </div>
        <Input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          placeholder="Search users, roles, audit, modules, tenants..."
          aria-label="Search Admin"
        />
        <p className="muted">Type at least 2 characters. Debounced to protect admin APIs.</p>
        {searchQuery.isLoading ? <p className="muted">Searching...</p> : null}
        {searchQuery.isError ? <p className="muted">Search unavailable. Try again.</p> : null}
        {flat.length === 0 && !searchQuery.isLoading ? <p className="muted">No matching results.</p> : null}

        <div className="stack">
          {[...grouped.entries()].map(([group, items]) => {
            const startIndex = offset;
            offset += items.length;
            return (
              <div key={group} className="panel">
                <div className="muted">{group}</div>
                <div className="stack" role="listbox" aria-label={`${group} results`}>
                  {items.map((item, idx) => {
                    const flatIndex = startIndex + idx;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={flatIndex === selectedIndex ? "paletteItem selected" : "paletteItem"}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        onClick={() => {
                          navigate(item.to);
                          onClose();
                        }}
                      >
                        <div><strong>{item.label}</strong></div>
                        <div className="muted">{item.detail}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
