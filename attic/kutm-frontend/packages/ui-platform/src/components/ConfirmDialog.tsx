import type { ModalComponentProps } from "../modals/modalTypes";

export function ConfirmDialog(
  props: ModalComponentProps<{ title: string; body?: string }, { confirmed: boolean }>
) {
  return (
    <div className="modal-card">
      <h3>{props.payload.title}</h3>
      <p>{props.payload.body}</p>
      <button onClick={() => props.close({ confirmed: true })}>Confirm</button>
      <button onClick={() => props.close(null)}>Cancel</button>
    </div>
  );
}
