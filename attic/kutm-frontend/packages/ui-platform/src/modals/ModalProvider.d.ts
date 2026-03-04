import { type PropsWithChildren } from "react";
import type { ModalMap } from "./modalTypes";
type ActiveEntry<K extends keyof ModalMap = keyof ModalMap> = {
    key: K;
    payload: ModalMap[K]["payload"];
    resolve: (result: ModalMap[K]["result"] | null) => void;
};
type ModalContextValue = {
    activeModal?: ActiveEntry;
    activeDrawer?: ActiveEntry;
    closeModal: (result: unknown | null) => void;
    closeDrawer: (result: unknown | null) => void;
};
export declare function ModalProvider({ children }: PropsWithChildren): import("react/jsx-runtime").JSX.Element;
export declare function useModalState(): ModalContextValue;
export {};
