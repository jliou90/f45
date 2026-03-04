import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useEditSession } from "@kutm/core";
export function CustomerEditDrawer({ payload, close }) {
    const sess = useEditSession({ entityType: "customer", entityId: payload.customerId, lock: true });
    const [status, setStatus] = useState("idle");
    return (_jsxs("div", { children: [_jsx("h3", { children: "Edit Customer" }), _jsx("label", { htmlFor: "customer-name", children: "Name" }), _jsx("input", { id: "customer-name", "data-testid": "customer-name-input", value: sess.draft?.name ?? "", onChange: (e) => sess.setDraft((d) => ({ ...d, name: e.target.value })) }), _jsxs("p", { children: ["Lock: ", sess.lock.status] }), _jsxs("div", { className: "row", children: [_jsx("button", { "data-testid": "save-customer", onClick: async () => {
                            const result = await sess.save();
                            if (result.ok) {
                                setStatus("saved");
                                close({ customerId: payload.customerId, changed: true });
                            }
                            else {
                                setStatus(result.error.code);
                            }
                        }, children: "Save" }), _jsx("button", { onClick: () => {
                            sess.cancel();
                            close({ customerId: payload.customerId, changed: false });
                        }, children: "Cancel" })] }), _jsx("p", { "data-testid": "save-status", children: status }), sess.error ? _jsx("p", { role: "alert", children: sess.error.message }) : null] }));
}
