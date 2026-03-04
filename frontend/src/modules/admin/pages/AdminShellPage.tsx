import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ApiError } from "../../../lib/api";
import { adminDetectImpersonationSupport, adminListUsers } from "../api";
import { AdminGlobalSearch } from "../components/AdminGlobalSearch";
import { setImpersonationBackendEnabled } from "../state/impersonation";

const links = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/invites", label: "Invites" },
  { to: "/admin/roles", label: "Roles" },
  { to: "/admin/permissions", label: "Effective Permissions" },
  { to: "/admin/audit", label: "Audit" },
  { to: "/admin/settings", label: "Tenant Config" },
  { to: "/admin/feature-flags", label: "Feature Flags" },
  { to: "/admin/theme", label: "Theme" },
  { to: "/admin/ops", label: "Ops Console" },
];

export function AdminShellPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await adminListUsers({ page: 1, size: 1 });
        const support = await adminDetectImpersonationSupport();
        setImpersonationBackendEnabled(support.enabled);
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as ApiError);
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!location.pathname.startsWith("/admin")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="panel">
        <h1>Admin</h1>
        <p className="muted">Loading access policy...</p>
      </div>
    );
  }

  if (error) {
    if (error?.status === 403) {
      return (
        <div className="panel">
          <h1>Access Denied</h1>
          <p className="muted">You need admin access to use this console.</p>
        </div>
      );
    }
    return (
      <div className="panel">
        <h1>Admin unavailable</h1>
        <p className="muted">
          Failed to load admin module. Request id: {error?.request_id ?? "n/a"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="sectionHeader">
          <div>
            <h1>Admin Console</h1>
            <p className="muted">Governance and tenant-wide controls.</p>
          </div>
          <button type="button" onClick={() => setSearchOpen(true)}>
            Search Admin... (Ctrl+K)
          </button>
        </div>
      </div>

      <div className="moduleLayout">
        <aside className="panel moduleNav">
          <h2>Admin</h2>
          <nav className="stack">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? "navLink active" : "navLink")}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <section>
          <Outlet />
        </section>
      </div>

      <AdminGlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
