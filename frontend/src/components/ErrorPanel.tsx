import { ApiError } from "../lib/api";

type Props = {
  error: unknown;
  title?: string;
};

function normalize(error: unknown) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      method: error.method,
      url: error.url,
      request_id: error.request_id,
      message: error.message,
      body: error.body,
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: String(error) };
}

export function ErrorPanel({ error, title = "Request Error" }: Props) {
  return (
    <div className="panel error">
      <h3>{title}</h3>
      <pre>{JSON.stringify(normalize(error), null, 2)}</pre>
    </div>
  );
}
