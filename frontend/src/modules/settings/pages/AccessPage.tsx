import { Link } from "react-router-dom";
import { Badge } from "../../../ui";
import { SETTINGS_CAPABILITIES, SETTINGS_NON_GOALS, SETTINGS_RBAC } from "../capabilities";
import { useSettingsState } from "../layout/SettingsLayout";

type MatrixRow = {
  section: string;
  action: string;
  required: string[];
};

function buildMatrixRows(): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const [section, actions] of Object.entries(SETTINGS_RBAC)) {
    for (const [action, required] of Object.entries(actions)) {
      rows.push({ section, action, required: [...required] });
    }
  }
  return rows;
}

function requiredPermissionsLabel(required: string[]): string {
  return required.join(", ");
}

export function AccessPage() {
  const { access } = useSettingsState();
  const rows = buildMatrixRows();

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Settings / Access & Permissions</div>
        <h1>Access & Permissions</h1>
        <p className="muted">This page explains what you can do in Settings and why actions may be disabled.</p>
      </div>

      <div className="panel stack">
        <h3>Your Settings RBAC Matrix</h3>
        <table className="dataTable">
          <thead>
            <tr>
              <th>Section</th>
              <th>Action</th>
              <th>Required permission(s)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const allowed = row.required.every((permission) => access.hasPermission(permission));
              return (
                <tr key={`${row.section}:${row.action}`}>
                  <td>{row.section}</td>
                  <td>{row.action}</td>
                  <td><code>{requiredPermissionsLabel(row.required)}</code></td>
                  <td><Badge tone={allowed ? "ok" : "warn"}>{allowed ? "Allowed" : "Disabled"}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {access.hasAdminInspectorAccess ? (
          <p className="muted">
            Need deeper inspection? <Link to="/admin/permissions?user=self&group=settings">Open Effective Permissions inspector</Link>.
          </p>
        ) : (
          <p className="muted">You do not have Admin access, so this page includes your local explanation.</p>
        )}
      </div>

      <div className="panel stack">
        <h3>Settings Can Do</h3>
        {Object.entries(SETTINGS_CAPABILITIES).map(([section, items]) => (
          <div key={section}>
            <strong>{section}</strong>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h3>Not Available in Settings</h3>
        <ul>
          {SETTINGS_NON_GOALS.map((item) => (
            <li key={item.action}>
              <strong>{item.action}:</strong> {item.note}{" "}
              {item.redirectTo ? <Link to={item.redirectTo}>Go to Admin</Link> : "Not available here."}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
