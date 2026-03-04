import { jsx as _jsx } from "react/jsx-runtime";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "../routes/routes";
export function AppRouter() {
    return (_jsx(BrowserRouter, { children: _jsx(AppRoutes, {}) }));
}
