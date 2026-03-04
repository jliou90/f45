import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { modalRegistry } from "./registry";
import type { ModalMap } from "./modalTypes";
import { setModalController } from "./openModal";

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

const ModalContext = createContext<ModalContextValue | null>(null);

function validate<K extends keyof ModalMap>(key: K, payload: ModalMap[K]["payload"]) {
  const spec = modalRegistry[key as string];
  if (!spec) {
    throw new Error(`Modal key not registered: ${String(key)}`);
  }

  const parsed = spec.payloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Invalid payload for ${String(key)}: ${parsed.error.message}`);
  }
}

export function ModalProvider({ children }: PropsWithChildren) {
  const [activeModal, setActiveModal] = useState<ActiveEntry>();
  const [activeDrawer, setActiveDrawer] = useState<ActiveEntry>();

  const value = useMemo<ModalContextValue>(
    () => ({
      activeModal,
      activeDrawer,
      closeModal: (result: unknown | null) => {
        setActiveModal((current: ActiveEntry | undefined) => {
          current?.resolve(result as never);
          return undefined;
        });
      },
      closeDrawer: (result: unknown | null) => {
        setActiveDrawer((current: ActiveEntry | undefined) => {
          current?.resolve(result as never);
          return undefined;
        });
      }
    }),
    [activeDrawer, activeModal]
  );

  setModalController({
    openModal: async (key, payload) => {
      validate(key, payload);
      return new Promise((resolve) => {
        setActiveModal({ key, payload, resolve } as ActiveEntry);
      });
    },
    openDrawer: async (key, payload) => {
      validate(key, payload);
      return new Promise((resolve) => {
        setActiveDrawer({ key, payload, resolve } as ActiveEntry);
      });
    }
  });

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModalState() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModalState must be used within ModalProvider");
  }
  return ctx;
}
