import type { ModalComponentProps } from "../modals/modalTypes";

type Payload = { entityType: string; entityId: string; attemptedIfMatch?: string };
type Result = { resolution: "reload" | "overwrite" | "cancel" };

export function ConflictDialog({ payload, close }: ModalComponentProps<Payload, Result>) {
  return (
    <div className="modal-card" data-testid="conflict-dialog">
      <h3>Conflict detected</h3>
      <p>
        {payload.entityType} {payload.entityId} changed on server.
      </p>
      <div className="row">
        <button data-testid="resolve-reload" onClick={() => close({ resolution: "reload" })}>
          Reload
        </button>
        <button data-testid="resolve-overwrite" onClick={() => close({ resolution: "overwrite" })}>
          Overwrite
        </button>
        <button onClick={() => close({ resolution: "cancel" })}>Cancel</button>
      </div>
    </div>
  );
}
