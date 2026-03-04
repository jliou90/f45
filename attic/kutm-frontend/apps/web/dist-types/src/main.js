import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import { configureApiClient } from "@kutm/core";
import { initializeMocking } from "@kutm/mocks";
import { App } from "./App";
import { API_BASE_URL, MSW_ENABLED } from "./config";
import "./styles/global.css";
async function bootstrap() {
    configureApiClient({ baseUrl: API_BASE_URL });
    if (MSW_ENABLED) {
        await initializeMocking();
    }
    const root = document.getElementById("root");
    if (!root) {
        throw new Error("Missing #root element");
    }
    createRoot(root).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
}
bootstrap();
