import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, setAccessToken, setRefreshToken, setTenantId } from "@kutm/core";
import { useAuth } from "./authStore";
export function LoginPage() {
    const [error, setError] = useState();
    const navigate = useNavigate();
    const { setAuthenticated } = useAuth();
    async function handleLogin() {
        setError(undefined);
        try {
            const login = await apiClient.request({ method: "POST", path: "/auth/login" });
            setAccessToken(login.data.accessToken);
            setRefreshToken(login.data.refreshToken);
            const me = await apiClient.request({ method: "GET", path: "/me" });
            const tenant = me.data.tenants[0];
            if (!tenant) {
                throw new Error("UNSPECIFIED: login requires at least one tenant");
            }
            setTenantId(tenant.id);
            setAuthenticated(true);
            navigate("/launcher", { replace: true });
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Login failed");
            setAuthenticated(false);
        }
    }
    return (_jsxs("section", { children: [_jsx("h2", { children: "Login" }), _jsx("p", { children: "Week 1 launcher login flow." }), _jsx("button", { "data-testid": "login-button", onClick: handleLogin, children: "Login as Demo User" }), error ? _jsx("p", { role: "alert", children: error }) : null] }));
}
