import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, useState } from "react";
import { setTenantId } from "@kutm/core";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [isAuthenticated, setAuthenticated] = useState(false);
    const value = useMemo(() => ({
        isAuthenticated,
        setAuthenticated: (v) => {
            if (!v) {
                setTenantId(undefined);
            }
            setAuthenticated(v);
        }
    }), [isAuthenticated]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return ctx;
}
