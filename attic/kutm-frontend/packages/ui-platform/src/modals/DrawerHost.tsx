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

  return (
    <div className="overlay drawer-overlay" onClick={() => closeDrawer(null)}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <Component payload={activeDrawer.payload} close={closeDrawer as never} />
      </aside>
    </div>
  );
}
