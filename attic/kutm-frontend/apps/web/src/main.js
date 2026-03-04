import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";
import { initializeMocking } from "@kutm/mocks";
async function bootstrap() {
    if (import.meta.env.VITE_USE_MSW !== "false") {
        await initializeMocking();
    }
    const root = document.getElementById("root");
    if (!root) {
        throw new Error("Missing #root element");
    }
    createRoot(root).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
}
bootstrap();
