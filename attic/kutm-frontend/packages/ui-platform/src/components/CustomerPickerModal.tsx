import { useState } from "react";
import type { ModalComponentProps } from "../modals/modalTypes";

type Payload = { initialQuery?: string };
type Result = { customerId: string; label: string };

export function CustomerPickerModal({ payload, close }: ModalComponentProps<Payload, Result>) {
  const [query, setQuery] = useState(payload.initialQuery ?? "");

  return (
    <div className="modal-card">
      <h3>Customer Picker</h3>
      <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Customer Query" />
      <button data-testid="picker-choose-c1" onClick={() => close({ customerId: "c1", label: "Alex Customer" })}>
        Pick Alex Customer
      </button>
      <button onClick={() => close(null)}>Close</button>
    </div>
  );
}
