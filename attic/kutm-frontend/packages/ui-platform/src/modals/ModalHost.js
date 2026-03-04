import { jsx as _jsx } from "react/jsx-runtime";
import { modalRegistry } from "./registry";
import { useModalState } from "./ModalProvider";
export function ModalHost() {
    const { activeModal, closeModal } = useModalState();
    if (!activeModal) {
        return null;
    }
    const spec = modalRegistry[activeModal.key];
    if (!spec || spec.kind !== "modal") {
        return null;
    }
    const Component = spec.Component;
    return (_jsx("div", { className: "overlay", onClick: () => closeModal(null), children: _jsx("div", { onClick: (e) => e.stopPropagation(), children: _jsx(Component, { payload: activeModal.payload, close: closeModal }) }) }));
}
