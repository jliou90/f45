export function Spinner({ label = "Loading..." }: { label?: string }) {
  return <span className="muted">{label}</span>;
}
