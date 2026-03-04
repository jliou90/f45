import { createContext } from "react";
import type { AuthMe } from "../lib/auth";

export type AuthContextValue = {
  user: AuthMe | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: (broadcast?: boolean) => void;
  refresh: () => Promise<void>;
  loadMe: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

