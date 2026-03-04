import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ConflictDialog({ payload, close }) {
    return (_jsxs("div", { className: "modal-card", "data-testid": "conflict-dialog", children: [_jsx("h3", { children: "Conflict detected" }), _jsxs("p", { children: [payload.entityType, " ", payload.entityId, " changed on server."] }), _jsxs("div", { className: "row", children: [_jsx("button", { "data-testid": "resolve-reload", onClick: () => close({ resolution: "reload" }), children: "Reload" }), _jsx("button", { "data-testid": "resolve-overwrite", onClick: () => close({ resolution: "overwrite" }), children: "Overwrite" }), _jsx("button", { onClick: () => close({ resolution: "cancel" }), children: "Cancel" })] })] }));
}
