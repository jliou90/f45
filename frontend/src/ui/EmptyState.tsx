export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      <p className="muted">{description}</p>
    </div>
  );
}
