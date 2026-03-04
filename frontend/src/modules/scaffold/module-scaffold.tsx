import { Link, Outlet, useLocation } from "react-router-dom";
import type { RoutePolicy } from "../../lib/rbac";

export type ModulePageDefinition = {
  path: string;
  title: string;
  purpose: string;
  data: string;
  actions: string;
};

export type ModuleDefinition = {
  id: string;
  navLabel: string;
  routeBase: string;
  routePolicy: RoutePolicy;
  tenantScoped: boolean;
  featureFlag?: string;
  pages: ModulePageDefinition[];
};

type ModuleShellProps = {
  module: ModuleDefinition;
};

export function ModuleShell({ module }: ModuleShellProps) {
  const location = useLocation();

  return (
    <div className="moduleLayout">
      <aside className="panel moduleNav">
        <h2>{module.navLabel}</h2>
        <nav className="stack">
          {module.pages.map((page) => {
            const to = `${module.routeBase}/${page.path}`;
            const active = location.pathname === to;
            return (
              <Link key={to} to={to} className={active ? "navLink active" : "navLink"}>
                {page.title}
              </Link>
            );
          })}
        </nav>
      </aside>
      <section>
        <Outlet />
      </section>
    </div>
  );
}

type ModulePageProps = {
  module: ModuleDefinition;
  page: ModulePageDefinition;
};

function fakeRows(moduleId: string, pagePath: string): Array<Record<string, string>> {
  return [
    { id: `${moduleId}-${pagePath}-001`, name: "Sample A", status: "Draft", updated: new Date().toISOString() },
    { id: `${moduleId}-${pagePath}-002`, name: "Sample B", status: "Pending", updated: new Date().toISOString() },
  ];
}

export function ModulePage({ module, page }: ModulePageProps) {
  const rows = fakeRows(module.id, page.path);

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">{module.navLabel} / {page.title}</div>
        <h1>{page.title}</h1>
        <div className="row">
          <input type="search" placeholder="Search (placeholder)" aria-label="Search" />
        </div>
      </div>

      <div className="panel">
        <h3>Purpose</h3>
        <p>{page.purpose}</p>
        <h3>What data will appear here</h3>
        <p>{page.data}</p>
        <h3>Primary actions</h3>
        <p>{page.actions}</p>
      </div>

      <div className="panel">
        <h3>List placeholder</h3>
        <table className="dataTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.name}</td>
                <td>{row.status}</td>
                <td>{new Date(row.updated).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
