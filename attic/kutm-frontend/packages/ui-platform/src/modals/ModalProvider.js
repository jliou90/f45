import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, useState } from "react";
import { modalRegistry } from "./registry";
import { setModalController } from "./openModal";
const ModalContext = createContext(null);
function validate(key, payload) {
    const spec = modalRegistry[key];
    if (!spec) {
        throw new Error(`Modal key not registered: ${String(key)}`);
    }
    const parsed = spec.payloadSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error(`Invalid payload for ${String(key)}: ${parsed.error.message}`);
    }
}
export function ModalProvider({ children }) {
    const [activeModal, setActiveModal] = useState();
    const [activeDrawer, setActiveDrawer] = useState();
    const value = useMemo(() => ({
        activeModal,
        activeDrawer,
        closeModal: (result) => {
            setActiveModal((current) => {
                current?.resolve(result);
                return undefined;
            });
        },
        closeDrawer: (result) => {
            setActiveDrawer((current) => {
                current?.resolve(result);
                return undefined;
            });
        }
    }), [activeDrawer, activeModal]);
    setModalController({
        openModal: async (key, payload) => {
            validate(key, payload);
            return new Promise((resolve) => {
                setActiveModal({ key, payload, resolve });
            });
        },
        openDrawer: async (key, payload) => {
            validate(key, payload);
            return new Promise((resolve) => {
                setActiveDrawer({ key, payload, resolve });
            });
        }
    });
    return _jsx(ModalContext.Provider, { value: value, children: children });
}
export function useModalState() {
    const ctx = useContext(ModalContext);
    if (!ctx) {
        throw new Error("useModalState must be used within ModalProvider");
    }
    return ctx;
}
