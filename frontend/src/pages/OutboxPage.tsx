import { useEffect, useState } from "react";
import { ErrorPanel } from "../components/ErrorPanel";
import {
  clear,
  del,
  list,
  redactSensitiveData,
  retry,
  retryAll,
  subscribeOutbox,
  type OutboxItem,
} from "../lib/outbox";
import { subscribeWindowSync } from "../lib/window-sync";
import { Button, Card } from "../ui";

const MAX_RETRY_COUNT = 5;

export function OutboxPage() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const refresh = async () => {
    const next = await list();
    setItems(next);
  };

  useEffect(() => {
    void refresh();
    const unsubLocal = subscribeOutbox(() => {
      void refresh();
    });
    const unsubWindow = subscribeWindowSync((event) => {
      if (event.type === "OUTBOX_UPDATED") {
        void refresh();
      }
    });
    return () => {
      unsubLocal();
      unsubWindow();
    };
  }, []);

  const retryItem = async (item: OutboxItem) => {
    setError(null);
    setBusyId(item.id);
    try {
      await retry(item.id);
      await refresh();
    } catch (err) {
      setError(err);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const retryAllItems = async () => {
    setBusyAll(true);
    try {
      await retryAll();
    } catch (err) {
      setError(err);
    } finally {
      await refresh();
      setBusyAll(false);
    }
  };

  return (
    <div className="stack">
      <Card>
        <h1>Outbox</h1>
        <p className="muted">Offline write queue stored in IndexedDB. Writes replay automatically when backend/session/tenant are ready.</p>
        <div className="row">
          <Button type="button" onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button type="button" disabled={busyAll} onClick={() => void retryAllItems()}>
            {busyAll ? "Retrying..." : "Retry all"}
          </Button>
          <Button
            type="button"
            onClick={() => {
              void clear().then(async () => {
                await refresh();
              });
            }}
          >
            Clear all
          </Button>
        </div>
      </Card>

      <Card className="tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Created</th>
              <th>Retry</th>
              <th>Body</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.method}</td>
                <td>{row.path}</td>
                <td>{row.createdAt}</td>
                <td>
                  {row.retryCount}
                  {row.retryCount >= MAX_RETRY_COUNT ? " (max)" : ""}
                </td>
                <td>
                  <code>{JSON.stringify(redactSensitiveData(row.body ?? {})).slice(0, 120)}</code>
                </td>
                <td>
                  <div className="row">
                    <Button
                      type="button"
                      disabled={busyId === row.id || row.retryCount >= MAX_RETRY_COUNT}
                      onClick={() => void retryItem(row)}
                    >
                      {busyId === row.id ? "Retrying..." : "Retry"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        void del(row.id).then(async () => {
                          await refresh();
                        });
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Outbox is empty.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {error ? <ErrorPanel error={error} title="Outbox retry failed" /> : null}
    </div>
  );
}
