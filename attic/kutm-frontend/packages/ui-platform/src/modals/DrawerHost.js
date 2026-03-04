import { jsx as _jsx } from "react/jsx-runtime";
import { modalRegistry } from "./registry";
import { useModalState } from "./ModalProvider";
export function DrawerHost() {
    const { activeDrawer, closeDrawer } = useModalState();
    if (!activeDrawer) {
        return null;
    }
    const spec = modalRegistry[activeDrawer.key];
    if (!spec || spec.kind !== "drawer") {
        return null;
    }
    const Component = spec.Component;
    return (_jsx("div", { className: "overlay", onClick: () => closeDrawer(null), children: _jsx("aside", { className: "drawer", onClick: (e) => e.stopPropagation(), children: _jsx(Component, { payload: activeDrawer.payload, close: closeDrawer }) }) }));
}
