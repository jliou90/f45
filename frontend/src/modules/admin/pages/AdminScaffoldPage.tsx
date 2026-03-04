export function AdminScaffoldPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel">
      <div className="muted">Admin</div>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
    </div>
  );
}
