import { useToast } from "../app/use-toast";

export function ToastViewport() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="toastViewport">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => removeToast(toast.id)}>
            x
          </button>
        </div>
      ))}
    </div>
  );
}

