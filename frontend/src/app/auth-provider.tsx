import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { login as loginRequest, logoutLocal, me, refresh as refreshRequest } from "../lib/auth";
import { getStoredAccessToken, getStoredRefreshToken } from "../lib/storage";
import { publishWindowSync, subscribeWindowSync } from "../lib/window-sync";
import { AuthContext, type AuthContextValue } from "./auth-state";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue["user"]>(null);

  const loadMe = useCallback(async () => {
    const profile = await me();
    setUser(profile);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginRequest(email, password);
      await loadMe();
    },
    [loadMe],
  );

  const refresh = useCallback(async () => {
    await refreshRequest();
    await loadMe();
  }, [loadMe]);

  const logout = useCallback((broadcast = true) => {
    logoutLocal();
    setUser(null);
    if (broadcast) {
      publishWindowSync({ type: "LOGOUT" });
    }
  }, []);

  useEffect(() => {
    return subscribeWindowSync((event) => {
      if (event.type === "LOGOUT") {
        logout(false);
      }
    });
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(getStoredAccessToken() && getStoredRefreshToken()),
      isInitializing: false,
      login,
      logout,
      refresh,
      loadMe,
    }),
    [user, login, logout, refresh, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

