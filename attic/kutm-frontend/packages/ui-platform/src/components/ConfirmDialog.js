import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ConfirmDialog(props) {
    return (_jsxs("div", { className: "modal-card", children: [_jsx("h3", { children: props.payload.title }), _jsx("p", { children: props.payload.body }), _jsx("button", { onClick: () => props.close({ confirmed: true }), children: "Confirm" }), _jsx("button", { onClick: () => props.close(null), children: "Cancel" })] }));
}
