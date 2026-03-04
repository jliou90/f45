import type { ModalComponentProps } from "../modals/modalTypes";
type Payload = {
    initialQuery?: string;
};
type Result = {
    customerId: string;
    label: string;
};
export declare function CustomerPickerModal({ payload, close }: ModalComponentProps<Payload, Result>): import("react/jsx-runtime").JSX.Element;
export {};
