import { useParams } from "react-router-dom";

export function CommsEditPage() {
  const params = useParams<{ itemId: string }>();
  return (
    <div className="panel">
      <h1>Comms Edit</h1>
      <p className="muted">Conversation edit route for {params.itemId}.</p>
    </div>
  );
}
