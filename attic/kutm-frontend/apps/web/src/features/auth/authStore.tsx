import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { setTenantId } from "@kutm/core";

type AuthContextValue = {
  isAuthenticated: boolean;
  setAuthenticated: (v: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setAuthenticated] = useState(false);

  const value = useMemo(
    () => ({
      isAuthenticated,
      setAuthenticated: (v: boolean) => {
        if (!v) {
          setTenantId(undefined);
        }
        setAuthenticated(v);
      }
    }),
    [isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
