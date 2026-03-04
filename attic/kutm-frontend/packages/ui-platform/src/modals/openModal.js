let controller;
export function setModalController(next) {
    controller = next;
}
export const openModal = async (key, payload) => {
    if (!controller) {
        throw new Error("ModalProvider is not mounted");
    }
    return controller.openModal(key, payload);
};
export const openDrawer = async (key, payload) => {
    if (!controller) {
        throw new Error("ModalProvider is not mounted");
    }
    return controller.openDrawer(key, payload);
};
