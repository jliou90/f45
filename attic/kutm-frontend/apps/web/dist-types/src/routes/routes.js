import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../app/AppShell";
import { LoginPage } from "../features/auth/LoginPage";
import { LauncherPage } from "../features/launcher/LauncherPage";
import { CustomerPage } from "../features/customer/CustomerPage";
import { useAuth } from "../features/auth/authStore";
function RequireAuth({ children }) {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? children : _jsx(Navigate, { to: "/login", replace: true });
}
export function AppRoutes() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsxs(Route, { element: _jsx(RequireAuth, { children: _jsx(AppShell, {}) }), children: [_jsx(Route, { path: "/launcher", element: _jsx(LauncherPage, {}) }), _jsx(Route, { path: "/customers/:customerId", element: _jsx(CustomerPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/launcher", replace: true }) })] }));
}
