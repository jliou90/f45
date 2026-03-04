import { Link, useParams } from "react-router-dom";

export function CommsDetailPage() {
  const params = useParams<{ itemId: string }>();
  return (
    <div className="panel">
      <h1>Comms Detail</h1>
      <p className="muted">Conversation detail route for {params.itemId}.</p>
      <p>
        <Link to={`/dms/comms/${params.itemId}/edit`}>Edit</Link>
      </p>
    </div>
  );
}
