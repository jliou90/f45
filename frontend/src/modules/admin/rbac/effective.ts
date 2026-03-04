import { getImpliedPermissions } from "../../../core/rbac/permissionCatalog";

export type EffectiveRole = {
  id: string;
  name: string;
  source: "direct" | "inherited";
};

export type PermissionExplanation = {
  permission: string;
  allowed: boolean;
  sources: string[];
  impliedBy: string[];
  deniedBy: string[];
  missingPrerequisites: string[];
};

export type EffectivePermissionsResult = {
  roles: EffectiveRole[];
  permissions: string[];
  explanations: Record<string, PermissionExplanation>;
};

export type PermissionDecision = {
  permission: string;
  allowed: boolean;
  reasons: string[];
  tree: Array<{ label: string; value: string }>;
};

export type EffectiveInput = {
  directRoles: Array<{ id: string; name: string; permissions: string[] }>;
  inheritedRoles?: Array<{ id: string; name: string; permissions: string[] }>;
  explicitDenies?: string[];
  featureGateByPermission?: Record<string, string[]>;
  enabledFeatureFlags?: Record<string, unknown>;
};

function normalizePermission(permission: string): string {
  return permission.trim().toLowerCase();
}

function isFlagEnabled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0 && value !== "0" && value.toLowerCase() !== "false";
  return Boolean(value);
}

export function computeEffectivePermissions(input: EffectiveInput): EffectivePermissionsResult {
  const directRoles = input.directRoles ?? [];
  const inheritedRoles = input.inheritedRoles ?? [];
  const denies = new Set((input.explicitDenies ?? []).map(normalizePermission));
  const featureGates = input.featureGateByPermission ?? {};
  const enabledFlags = input.enabledFeatureFlags ?? {};

  const roles: EffectiveRole[] = [
    ...directRoles.map((role) => ({ id: role.id, name: role.name, source: "direct" as const })),
    ...inheritedRoles.map((role) => ({ id: role.id, name: role.name, source: "inherited" as const })),
  ];

  const permissionSources = new Map<string, Set<string>>();
  const impliedBy = new Map<string, Set<string>>();
  for (const role of [...directRoles, ...inheritedRoles]) {
    for (const rawPermission of role.permissions) {
      const permission = normalizePermission(rawPermission);
      const sources = permissionSources.get(permission) ?? new Set<string>();
      sources.add(role.name);
      permissionSources.set(permission, sources);

      for (const implied of getImpliedPermissions(permission)) {
        const impliedSources = permissionSources.get(implied) ?? new Set<string>();
        impliedSources.add(`${role.name} (implied)`);
        permissionSources.set(implied, impliedSources);
        const impliedByList = impliedBy.get(implied) ?? new Set<string>();
        impliedByList.add(permission);
        impliedBy.set(implied, impliedByList);
      }
    }
  }

  const permissions = [...permissionSources.keys()].sort((a, b) => a.localeCompare(b));
  const explanations: Record<string, PermissionExplanation> = {};

  for (const permission of permissions) {
    const sources = [...(permissionSources.get(permission) ?? new Set<string>())].sort((a, b) => a.localeCompare(b));
    const impliedByPermissions = [...(impliedBy.get(permission) ?? new Set<string>())].sort((a, b) => a.localeCompare(b));
    const deniedBy = denies.has(permission) ? ["explicit_deny"] : [];
    const missingPrerequisites: string[] = [];
    const gates = featureGates[permission] ?? [];
    for (const gate of gates) {
      if (!isFlagEnabled(enabledFlags[gate])) {
        missingPrerequisites.push(`feature_flag:${gate}`);
      }
    }
    explanations[permission] = {
      permission,
      allowed: deniedBy.length === 0 && missingPrerequisites.length === 0,
      sources,
      impliedBy: impliedByPermissions,
      deniedBy,
      missingPrerequisites,
    };
  }

  return {
    roles,
    permissions,
    explanations,
  };
}

export function explainDecision(permission: string, effective: EffectivePermissionsResult): PermissionDecision {
  const normalized = normalizePermission(permission);
  const explanation = effective.explanations[normalized];

  if (!explanation) {
    return {
      permission: normalized,
      allowed: false,
      reasons: ["No role grants this permission."],
      tree: [
        { label: "Permission", value: normalized },
        { label: "Result", value: "Denied" },
        { label: "Why", value: "No source role contains this permission." },
      ],
    };
  }

  const reasons: string[] = [];
  if (explanation.sources.length > 0) {
    reasons.push(`Granted by role(s): ${explanation.sources.join(", ")}.`);
  }
  if (explanation.impliedBy.length > 0) {
    reasons.push(`Implied by: ${explanation.impliedBy.join(", ")}.`);
  }
  if (explanation.deniedBy.length > 0) {
    reasons.push(`Denied by: ${explanation.deniedBy.join(", ")}.`);
  }
  if (explanation.missingPrerequisites.length > 0) {
    reasons.push(`Blocked by prerequisites: ${explanation.missingPrerequisites.join(", ")}.`);
  }

  return {
    permission: normalized,
    allowed: explanation.allowed,
    reasons,
    tree: [
      { label: "Permission", value: normalized },
      { label: "Result", value: explanation.allowed ? "Allowed" : "Denied" },
      { label: "Sources", value: explanation.sources.join(", ") || "none" },
      { label: "Implied by", value: explanation.impliedBy.join(", ") || "none" },
      { label: "Explicit denies", value: explanation.deniedBy.join(", ") || "none" },
      { label: "Missing prerequisites", value: explanation.missingPrerequisites.join(", ") || "none" },
    ],
  };
}
