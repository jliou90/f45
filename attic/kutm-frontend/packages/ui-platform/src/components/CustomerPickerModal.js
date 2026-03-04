import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function CustomerPickerModal({ payload, close }) {
    const [query, setQuery] = useState(payload.initialQuery ?? "");
    return (_jsxs("div", { className: "modal-card", children: [_jsx("h3", { children: "Customer Picker" }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), "aria-label": "Customer Query" }), _jsx("button", { "data-testid": "picker-choose-c1", onClick: () => close({ customerId: "c1", label: "Alex Customer" }), children: "Pick Alex Customer" }), _jsx("button", { onClick: () => close(null), children: "Close" })] }));
}
