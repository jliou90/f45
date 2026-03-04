import { Navigate, Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AdminAuditPage } from "../../modules/admin/pages/AdminAuditPage";
import { AdminFeatureFlagsPage } from "../../modules/admin/pages/AdminFeatureFlagsPage";
import { AdminInvitesPage } from "../../modules/admin/pages/AdminInvitesPage";
import { AdminRolesPage } from "../../modules/admin/pages/AdminRolesPage";
import { AdminSettingsPage } from "../../modules/admin/pages/AdminSettingsPage";
import { AdminShellPage } from "../../modules/admin/pages/AdminShellPage";
import { AdminThemePage } from "../../modules/admin/pages/AdminThemePage";
import { AdminUsersPage } from "../../modules/admin/pages/AdminUsersPage";
import { EffectivePermissionsPage } from "../../modules/admin/pages/EffectivePermissionsPage";
import type { ModulePlugin } from "../types";

export const adminPlugin: ModulePlugin = {
  id: "core.admin",
  name: "Admin",
  version: "1.0.0",
  description: "Tenant administration for users, roles, permissions, and audit.",
  keywords: ["admin", "users", "roles", "audit", "rbac"],
  routeBase: "/admin",
  nav: {
    section: "OPS",
    label: "Admin",
    order: 105,
  },
  routePolicy: "ADMIN",
  requiredRoutes: [
    { path: "/api/v1/admin/users", method: "GET" },
    { path: "/api/v1/admin/roles", method: "GET" },
    { path: "/api/v1/admin/audit", method: "GET" },
  ],
  routes: () => (
    <Route
      path="/admin"
      element={
        <ProtectedRoute route="ADMIN" requireTenant>
          <AdminShellPage />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/admin/users" replace />} />
      <Route path="users" element={<AdminUsersPage />} />
      <Route path="invites" element={<AdminInvitesPage />} />
      <Route path="roles" element={<AdminRolesPage />} />
      <Route path="permissions" element={<EffectivePermissionsPage />} />
      <Route path="audit" element={<AdminAuditPage />} />
      <Route path="settings" element={<AdminSettingsPage />} />
      <Route path="feature-flags" element={<AdminFeatureFlagsPage />} />
      <Route path="theme" element={<AdminThemePage />} />
    </Route>
  ),
  launcherTiles: () => [
    {
      id: "admin",
      name: "Admin",
      description: "Manage users, roles, permissions, and audit events.",
      to: "/admin/users",
      keywords: ["admin", "users", "roles", "rbac", "audit"],
    },
  ],
};
