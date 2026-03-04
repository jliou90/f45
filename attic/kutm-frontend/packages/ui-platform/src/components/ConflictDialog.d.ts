import type { ModalComponentProps } from "../modals/modalTypes";
type Payload = {
    entityType: string;
    entityId: string;
    attemptedIfMatch?: string;
};
type Result = {
    resolution: "reload" | "overwrite" | "cancel";
};
export declare function ConflictDialog({ payload, close }: ModalComponentProps<Payload, Result>): import("react/jsx-runtime").JSX.Element;
export {};
