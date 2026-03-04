import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, setAccessToken, setRefreshToken, setTenantId } from "@kutm/core";
import type { LoginResponse, MeResponse } from "./authTypes";
import { useAuth } from "./authStore";

export function LoginPage() {
  const [error, setError] = useState<string>();
  const navigate = useNavigate();
  const { setAuthenticated } = useAuth();

  async function handleLogin() {
    setError(undefined);
    try {
      const login = await apiClient.request<LoginResponse>({ method: "POST", path: "/auth/login" });
      setAccessToken(login.data.accessToken);
      setRefreshToken(login.data.refreshToken);

      const me = await apiClient.request<MeResponse>({ method: "GET", path: "/me" });
      const tenant = me.data.tenants[0];
      if (!tenant) {
        throw new Error("UNSPECIFIED: login requires at least one tenant");
      }

      setTenantId(tenant.id);
      setAuthenticated(true);
      navigate("/launcher", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      setAuthenticated(false);
    }
  }

  return (
    <section>
      <h2>Login</h2>
      <p>Week 1 launcher login flow.</p>
      <button data-testid="login-button" onClick={handleLogin}>
        Login as Demo User
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
