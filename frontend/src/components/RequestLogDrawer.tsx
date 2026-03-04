import { useMemo, useState } from "react";
import { useTelemetry } from "../app/use-telemetry";
import { Drawer } from "./Drawer";
import { ErrorPanel } from "./ErrorPanel";

export function RequestLogDrawer() {
  const telemetry = useTelemetry();
  const [filterType, setFilterType] = useState<"all" | "success" | "error">("all");
  const [search, setSearch] = useState("");
  const [lastN, setLastN] = useState(50);
  const [copyError, setCopyError] = useState<unknown>(null);

  const visible = useMemo(() => {
    return telemetry.logs
      .filter((entry) => {
        if (filterType === "success") return entry.success;
        if (filterType === "error") return !entry.success;
        return true;
      })
      .filter((entry) => {
        if (!search.trim()) return true;
        const needle = search.toLowerCase();
        return `${entry.method} ${entry.path} ${entry.status} ${entry.request_id ?? ""} ${entry.errorMessage ?? ""}`
          .toLowerCase()
          .includes(needle);
      })
      .slice(0, lastN);
  }, [telemetry.logs, filterType, search, lastN]);

  const onCopy = async () => {
    setCopyError(null);
    try {
      await telemetry.copyDebugBundle();
    } catch (error) {
      setCopyError(error);
    }
  };

  return (
    <Drawer open={telemetry.drawerOpen} title="Request Log" onClose={() => telemetry.setDrawerOpen(false)}>
      <div className="stack">
        <div className="filterRow">
          <select value={filterType} onChange={(event) => setFilterType(event.target.value as "all" | "success" | "error")}>
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <input placeholder="Search path/status/request_id" value={search} onChange={(event) => setSearch(event.target.value)} />
          <input
            type="number"
            min={1}
            max={300}
            value={lastN}
            onChange={(event) => setLastN(Number(event.target.value) || 50)}
          />
          <button type="button" onClick={onCopy}>
            Copy debug bundle
          </button>
        </div>
        {copyError ? <ErrorPanel error={copyError} title="Copy failed" /> : null}
        <div className="logList">
          {visible.map((entry) => (
            <div key={entry.id} className={`logRow ${entry.success ? "ok" : "bad"}`}>
              <div>
                <strong>
                  {entry.method} {entry.path}
                </strong>
              </div>
              <div className="muted">
                status={entry.status} duration={entry.durationMs}ms request_id={entry.request_id ?? "(none)"} at {entry.time}
              </div>
              {entry.errorMessage ? <div>{entry.errorMessage}</div> : null}
            </div>
          ))}
          {visible.length === 0 ? <div className="muted">No matching request logs.</div> : null}
        </div>
      </div>
    </Drawer>
  );
}

