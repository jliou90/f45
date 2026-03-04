import { Link, Outlet } from "react-router-dom";
import { DrawerHost, ModalHost } from "@kutm/ui-platform";

export function AppShell() {
  return (
    <>
      <header className="topbar">
        <h1>KUTM Frontend</h1>
        <nav>
          <Link to="/launcher">Launcher</Link>
          <Link to="/customers/c1">Customer</Link>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <DrawerHost />
      <ModalHost />
    </>
  );
}
