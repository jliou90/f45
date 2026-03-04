import type { ModalMap } from "./modalTypes";
type ModalController = {
    openModal: <K extends keyof ModalMap>(key: K, payload: ModalMap[K]["payload"]) => Promise<ModalMap[K]["result"] | null>;
    openDrawer: <K extends keyof ModalMap>(key: K, payload: ModalMap[K]["payload"]) => Promise<ModalMap[K]["result"] | null>;
};
export declare function setModalController(next: ModalController): void;
export type OpenModal = <K extends keyof ModalMap>(key: K, payload: ModalMap[K]["payload"]) => Promise<ModalMap[K]["result"] | null>;
export declare const openModal: OpenModal;
export declare const openDrawer: OpenModal;
export {};
