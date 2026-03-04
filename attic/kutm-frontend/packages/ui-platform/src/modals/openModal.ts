import type { ModalMap } from "./modalTypes";

type ModalController = {
  openModal: <K extends keyof ModalMap>(
    key: K,
    payload: ModalMap[K]["payload"]
  ) => Promise<ModalMap[K]["result"] | null>;
  openDrawer: <K extends keyof ModalMap>(
    key: K,
    payload: ModalMap[K]["payload"]
  ) => Promise<ModalMap[K]["result"] | null>;
};

let controller: ModalController | undefined;

export function setModalController(next: ModalController) {
  controller = next;
}

export type OpenModal = <K extends keyof ModalMap>(
  key: K,
  payload: ModalMap[K]["payload"]
) => Promise<ModalMap[K]["result"] | null>;

export const openModal: OpenModal = async (key, payload) => {
  if (!controller) {
    throw new Error("ModalProvider is not mounted");
  }
  return controller.openModal(key, payload);
};

export const openDrawer: OpenModal = async (key, payload) => {
  if (!controller) {
    throw new Error("ModalProvider is not mounted");
  }
  return controller.openDrawer(key, payload);
};
