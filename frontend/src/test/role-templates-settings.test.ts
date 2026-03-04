import { describe, expect, it } from "vitest";
import { applyPermissionImplications, togglePermissionWithImplications } from "../core/rbac/permissionCatalog";
import { applyRoleTemplate, settingsPermissionsForTemplate } from "../core/rbac/roleTemplates";

describe("settings permission implication rules", () => {
  it("write implies read", () => {
    const out = applyPermissionImplications(["settings.preferences.write"]);
    expect(out).toContain("settings.preferences.read");
    expect(out).toContain("settings.preferences.write");
  });

  it("unchecking read also unchecks write", () => {
    const initial = ["settings.preferences.read", "settings.preferences.write"];
    const out = togglePermissionWithImplications(initial, "settings.preferences.read", false);
    expect(out).not.toContain("settings.preferences.read");
    expect(out).not.toContain("settings.preferences.write");
  });
});

describe("role templates", () => {
  it("viewer template keeps non-settings permissions and sets read-only settings defaults", () => {
    const out = applyRoleTemplate("viewer", ["admin.users.read", "settings.preferences.write"]);
    expect(out).toContain("admin.users.read");
    expect(out).toContain("settings.preferences.read");
    expect(out).not.toContain("settings.preferences.write");
  });

  it("manager template includes writable settings defaults", () => {
    const out = settingsPermissionsForTemplate("manager");
    expect(out).toContain("settings.workspace.write");
    expect(out).toContain("settings.workspace.read");
  });
});
