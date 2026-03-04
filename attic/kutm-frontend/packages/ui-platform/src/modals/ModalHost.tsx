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
  return (
    <div className="overlay modal-overlay" onClick={() => closeModal(null)}>
      <div onClick={(e) => e.stopPropagation()}>
        <Component payload={activeModal.payload} close={closeModal as never} />
      </div>
    </div>
  );
}
