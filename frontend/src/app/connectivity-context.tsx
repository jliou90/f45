import { createContext } from "react";
import type { ConnectivityContextValue } from "./connectivity-state";

export const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);
