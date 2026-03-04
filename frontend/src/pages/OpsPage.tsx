import { useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "../lib/version";
import { useTenant } from "../app/use-tenant";
import {
  exportOpsBundle,
  getOpsSnapshot,
  initOpsInstrumentation,
  setOpsCaptureEnabled,
  setOpsLogLevel,
  subscribeOps,
  type OpsLogLevel,
  type OpsSnapshot,
} from "../core/ops";
import { opsLogsTail, opsStatus } from "../lib/auth";
import { useQuery } from "../lib/query";
import { publishWindowSync, subscribeWindowSync } from "../lib/window-sync";

const tabs = ["Overview", "Frontend", "Network", "Errors", "Performance", "Backend", "Export"] as const;
type OpsTab = (typeof tabs)[number];

function downloadFile(filename: string, payload: string) {
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCurl(item: OpsSnapshot["network"][number]): string {
  return `curl -X ${item.method} '${item.url}' -H 'X-Client-Request-Id: ${item.clientRequestId ?? "generated"}'`;
}

export function OpsPage() {
  const tenant = useTenant();
  const [activeTab, setActiveTab] = useState<OpsTab>("Overview");
  const [snapshot, setSnapshot] = useState<OpsSnapshot>(() => getOpsSnapshot());
  const statusQuery = useQuery(() => opsStatus(), { deps: [tenant.tenantId] });
  const logsQuery = useQuery(() => opsLogsTail(50), { deps: [tenant.tenantId] });

  useEffect(() => {
    initOpsInstrumentation();
  }, []);

  useEffect(() => {
    return subscribeOps(setSnapshot);
  }, []);

  useEffect(() => {
    return subscribeWindowSync((event) => {
      if (event.type === "OPS_CAPTURE_UPDATED") {
        const enabled = Boolean(event.payload?.enabled);
        setOpsCaptureEnabled(enabled);
      }
      if (event.type === "OPS_LOG_LEVEL_UPDATED") {
        const level = event.payload?.level;
        if (level === "error" || level === "warn" || level === "info" || level === "debug") {
          setOpsLogLevel(level);
        }
      }
    });
  }, []);

  const failedNetwork = useMemo(() => snapshot.network.filter((item) => !item.ok), [snapshot.network]);

  const onExport = () => {
    const payload = exportOpsBundle({
      appVersion: APP_VERSION,
      tenantId: tenant.tenantId,
      backendStatus: statusQuery.data ?? null,
    });
    downloadFile(`kutm-diagnostics-${Date.now()}.json`, payload);
    publishWindowSync({ type: "OPS_EXPORT_TRIGGERED", payload: { at: new Date().toISOString() } });
  };

  return (
    <div className="stack">
      <div className="panel">
        <h1>Ops Console</h1>
        <p className="muted">Monitoring and diagnostics for frontend and backend behavior.</p>
        <div className="row">
          <label>
            Capture
            <select
              value={snapshot.enabled ? "on" : "off"}
              onChange={(event) => {
                const enabled = event.target.value === "on";
                setOpsCaptureEnabled(enabled);
                publishWindowSync({ type: "OPS_CAPTURE_UPDATED", payload: { enabled } });
              }}
            >
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label>
            Log Level
            <select
              value={snapshot.logLevel}
              onChange={(event) => {
                const level = event.target.value as OpsLogLevel;
                setOpsLogLevel(level);
                publishWindowSync({ type: "OPS_LOG_LEVEL_UPDATED", payload: { level } });
              }}
            >
              <option value="error">error</option>
              <option value="warn">warn</option>
              <option value="info">info</option>
              <option value="debug">debug</option>
            </select>
          </label>
          <button type="button" onClick={onExport}>
            Export diagnostics
          </button>
        </div>
      </div>

      <div className="panel row">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? "badge ok" : "badge neutral"} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" ? (
        <div className="panel">
          <p>Errors: {snapshot.errors.length}</p>
          <p>Network events: {snapshot.network.length}</p>
          <p>Failed requests: {failedNetwork.length}</p>
          <p>Performance points: {snapshot.performance.length}</p>
        </div>
      ) : null}

      {activeTab === "Frontend" ? (
        <div className="panel">
          <h3>Console</h3>
          <pre>{JSON.stringify(snapshot.consoleEvents.slice(0, 50), null, 2)}</pre>
        </div>
      ) : null}

      {activeTab === "Network" ? (
        <div className="panel">
          <h3>Network</h3>
          <table className="dataTable">
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Request ID</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.network.slice(0, 100).map((item) => (
                <tr key={item.id}>
                  <td>{item.method}</td>
                  <td>{item.path}</td>
                  <td>{item.status}</td>
                  <td>{Math.round(item.durationMs)}ms</td>
                  <td>{item.requestId ?? "n/a"}</td>
                  <td>
                    {!item.ok ? (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(toCurl(item));
                        }}
                      >
                        Copy curl
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === "Errors" ? (
        <div className="panel">
          <h3>Errors</h3>
          <pre>{JSON.stringify(snapshot.errors.slice(0, 100), null, 2)}</pre>
        </div>
      ) : null}

      {activeTab === "Performance" ? (
        <div className="panel">
          <h3>Performance</h3>
          <pre>{JSON.stringify(snapshot.performance.slice(0, 100), null, 2)}</pre>
        </div>
      ) : null}

      {activeTab === "Backend" ? (
        <div className="stack">
          <div className="panel">
            <h3>/api/v1/ops/status</h3>
            {statusQuery.isLoading ? <p>Loading...</p> : null}
            {statusQuery.data ? <pre>{JSON.stringify(statusQuery.data, null, 2)}</pre> : null}
          </div>
          <div className="panel">
            <h3>/api/v1/ops/logs/tail</h3>
            {logsQuery.isLoading ? <p>Loading...</p> : null}
            {logsQuery.data ? <pre>{JSON.stringify(logsQuery.data, null, 2)}</pre> : null}
          </div>
        </div>
      ) : null}

      {activeTab === "Export" ? (
        <div className="panel">
          <p>Export includes build info, tenant id, redacted network/errors, perf snapshot, and backend status.</p>
          <button type="button" onClick={onExport}>
            Export diagnostics
          </button>
        </div>
      ) : null}
    </div>
  );
}
