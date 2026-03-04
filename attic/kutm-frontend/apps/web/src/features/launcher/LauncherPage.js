import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useNavigate } from "react-router-dom";
import { useMe } from "@kutm/core";
import { openDrawer, openModal } from "@kutm/ui-platform";
export function LauncherPage() {
    const navigate = useNavigate();
    const me = useMe();
    return (_jsxs("section", { children: [_jsx("h2", { children: "Launcher" }), me.isLoading ? _jsx("p", { children: "Loading /me ..." }) : null, me.data ? (_jsxs(_Fragment, { children: [_jsx("p", { "data-testid": "launcher-user", children: me.data.user.name }), _jsxs("div", { className: "row", children: [_jsx("button", { "data-testid": "open-picker", onClick: async () => {
                                    const picked = await openModal("customer.picker", { initialQuery: "Alex" });
                                    if (picked) {
                                        navigate(`/customers/${picked.customerId}`);
                                    }
                                }, children: "Open Customer Picker" }), _jsx("button", { "data-testid": "open-edit", onClick: () => openDrawer("customer.edit", { customerId: "c1" }), children: "Open Customer Edit Drawer" }), _jsx(Link, { to: "/customers/c1", children: "Go to customer route" })] })] })) : null] }));
}
