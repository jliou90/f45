import { type PropsWithChildren } from "react";
type AuthContextValue = {
    isAuthenticated: boolean;
    setAuthenticated: (v: boolean) => void;
};
export declare function AuthProvider({ children }: PropsWithChildren): import("react/jsx-runtime").JSX.Element;
export declare function useAuth(): AuthContextValue;
export {};
