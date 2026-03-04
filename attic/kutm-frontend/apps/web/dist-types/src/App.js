import { jsx as _jsx } from "react/jsx-runtime";
import { Providers } from "./app/Providers";
import { AppRouter } from "./app/Router";
export function App() {
    return (_jsx(Providers, { children: _jsx(AppRouter, {}) }));
}
