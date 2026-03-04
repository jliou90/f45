import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, Outlet } from "react-router-dom";
import { DrawerHost, ModalHost } from "@kutm/ui-platform";
export function AppShell() {
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: "topbar", children: [_jsx("h1", { children: "KUTM Frontend" }), _jsxs("nav", { children: [_jsx(Link, { to: "/launcher", children: "Launcher" }), _jsx(Link, { to: "/customers/c1", children: "Customer" })] })] }), _jsx("main", { className: "content", children: _jsx(Outlet, {}) }), _jsx(ModalHost, {}), _jsx(DrawerHost, {})] }));
}
