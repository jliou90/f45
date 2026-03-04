import { useState } from "react";
import { useEditSession } from "@kutm/core";
import type { ModalComponentProps } from "../modals/modalTypes";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export function CustomerEditDrawer({
  payload,
  close
}: ModalComponentProps<{ customerId: string }, { customerId: string; changed: boolean }>) {
  const sess = useEditSession<Customer>({ entityType: "customer", entityId: payload.customerId, lock: true });
  const [status, setStatus] = useState("idle");

  return (
    <div>
      <h3>Edit Customer</h3>
      <label htmlFor="customer-name">Name</label>
      <input
        id="customer-name"
        data-testid="customer-name-input"
        value={sess.draft?.name ?? ""}
        onChange={(e) => sess.setDraft((d) => ({ ...d, name: e.target.value }))}
      />
      <p>Lock: {sess.lock.status}</p>
      <div className="row">
        <button
          data-testid="save-customer"
          onClick={async () => {
            const result = await sess.save();
            if (result.ok) {
              setStatus("saved");
              close({ customerId: payload.customerId, changed: true });
            } else {
              setStatus(result.error.code);
            }
          }}
        >
          Save
        </button>
        <button
          onClick={() => {
            sess.cancel();
            close({ customerId: payload.customerId, changed: false });
          }}
        >
          Cancel
        </button>
      </div>
      <p data-testid="save-status">{status}</p>
      {sess.error ? <p role="alert">{sess.error.message}</p> : null}
    </div>
  );
}
