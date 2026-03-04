import type { ReactNode } from "react";

type DrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  if (!open) return null;
  return (
    <div className="drawerOverlay" role="dialog" aria-modal="true">
      <div className="drawer">
        <div className="drawerHeader">
          <h3>{title}</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawerBody">{children}</div>
      </div>
    </div>
  );
}
