import { useEffect, useMemo, useState } from "react";
import { API_BASE_ORIGIN } from "../lib/kutm";

type TileState = "green" | "yellow" | "red";

type VersionPayload = {
  product_name?: string;
  version?: string;
  git_sha?: string | null;
};

type ReadyPayload = {
  ready?: boolean;
  checks?: Record<string, boolean>;
  migrations?: {
    expected_heads?: string[];
    current_heads?: string[];
  };
  error?: string | null;
};

export function SystemPage() {
  const [version, setVersion] = useState<VersionPayload | null>(null);
  const [ready, setReady] = useState<ReadyPayload | null>(null);
  const [apiReachable, setApiReachable] = useState<boolean>(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const versionResp = await fetch(`${API_BASE_ORIGIN}/api/v1/ops/version`, { cache: "no-store" });
        const readyResp = await fetch(`${API_BASE_ORIGIN}/readyz`, { cache: "no-store" });
        if (cancelled) {
          return;
        }

        if (versionResp.ok) {
          setVersion((await versionResp.json()) as VersionPayload);
        }
        if (readyResp.ok || readyResp.status === 503) {
          setReady((await readyResp.json()) as ReadyPayload);
        }
        setApiReachable(versionResp.ok || readyResp.ok || readyResp.status === 503);
      } catch {
        if (!cancelled) {
          setApiReachable(false);
        }
      } finally {
        if (!cancelled) {
          setLastCheckedAt(new Date().toISOString());
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const apiTile = useMemo<TileState>(() => (apiReachable ? "green" : "red"), [apiReachable]);
  const dbTile = useMemo<TileState>(() => {
    if (!ready?.checks) return "yellow";
    return ready.checks.db ? "green" : "red";
  }, [ready]);
  const migrationTile = useMemo<TileState>(() => {
    if (!ready?.checks) return "yellow";
    return ready.checks.migrations ? "green" : "red";
  }, [ready]);

  return (
    <div className="stack">
      <div className="panel">
        <h1>System Status</h1>
        <p className="muted">Local appliance status for this machine.</p>
        <p className="badge warn">For Start/Stop/Backup/Diagnostics open KUTM Control Panel (tray icon).</p>
      </div>

      <div className="systemTileGrid">
        <div className={`systemTile ${apiTile}`}>
          <h3>Backend</h3>
          <p>{apiReachable ? "Reachable" : "Unreachable"}</p>
        </div>
        <div className={`systemTile ${dbTile}`}>
          <h3>Database</h3>
          <p>{ready?.checks?.db ? "Healthy" : "Check Required"}</p>
        </div>
        <div className={`systemTile ${migrationTile}`}>
          <h3>Migrations</h3>
          <p>{ready?.checks?.migrations ? "At Head" : "Not At Head"}</p>
        </div>
        <div className={`systemTile ${apiTile}`}>
          <h3>Version</h3>
          <p>{version?.version ?? "unknown"}</p>
        </div>
      </div>

      <div className="panel">
        <h3>Version</h3>
        <p>
          Product: <strong>{version?.product_name ?? "KUTM"}</strong>
        </p>
        <p>
          Version: <strong>{version?.version ?? "unknown"}</strong>
        </p>
        <p>Git SHA: {version?.git_sha ?? "n/a"}</p>
        <p className="muted">Last checked: {lastCheckedAt ?? "pending"}</p>
        {ready?.error ? <p className="badge danger">Readyz error: {ready.error}</p> : null}
      </div>
    </div>
  );
}
