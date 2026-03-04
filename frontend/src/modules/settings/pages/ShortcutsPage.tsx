import { SETTINGS_RBAC } from "../capabilities";
import { SectionGate } from "../components/SectionGate";

export function ShortcutsPage() {
  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Settings / Shortcuts</div>
        <h1>Keyboard Shortcuts</h1>
      </div>

      <SectionGate readPerm={SETTINGS_RBAC.shortcuts.read[0]} title="Keyboard shortcuts">
        <div className="panel">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Shortcut</th>
                <th>Scope</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>Ctrl+K</code></td>
                <td>Global</td>
                <td>Open command palette</td>
              </tr>
              <tr>
                <td><code>Ctrl+K</code></td>
                <td>Admin</td>
                <td>Open Admin global search</td>
              </tr>
              <tr>
                <td><code>Esc</code></td>
                <td>Modal/Palette</td>
                <td>Close current dialog</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionGate>
    </div>
  );
}
