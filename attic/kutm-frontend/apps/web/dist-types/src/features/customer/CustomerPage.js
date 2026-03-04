import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useParams } from "react-router-dom";
import { openDrawer } from "@kutm/ui-platform";
export function CustomerPage() {
    const { customerId = "c1" } = useParams();
    return (_jsxs("section", { children: [_jsxs("h2", { children: ["Customer ", customerId] }), _jsx("button", { "data-testid": "page-open-edit", onClick: () => openDrawer("customer.edit", { customerId }), children: "Edit Customer" })] }));
}
