import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PortalSearchPanel } from "../../../components/PortalSearchPanel";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import {
  getActionCenterPrefs,
  getActionCenterQueue,
  saveActionCenterPrefs,
  type ActionCenterSavedView,
  type TeamQueueMode,
} from "../api";

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ActionCenterPage() {
  const [selectedMode, setSelectedMode] = useState<TeamQueueMode>("role_default");
  const [viewName, setViewName] = useState("");
  const [viewQuery, setViewQuery] = useState("");
  const [viewModules, setViewModules] = useState<string[]>(["customers", "accounting"]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const prefsQuery = useQuery(() => getActionCenterPrefs());
  const queueQuery = useQuery(() => getActionCenterQueue(selectedMode), {
    deps: [selectedMode],
  });

  const counts = useMemo(() => queueQuery.data?.summary, [queueQuery.data]);
  const prefs = prefsQuery.data;

  const toggleViewModule = (module: string) => {
    setViewModules((current) => {
      if (current.includes(module)) {
        const next = current.filter((item) => item !== module);
        return next.length > 0 ? next : current;
      }
      return [...current, module];
    });
  };

  const applySavedView = async (view: ActionCenterSavedView) => {
    setViewName(view.name);
    setViewQuery(view.query);
    setViewModules(view.modules.length > 0 ? view.modules : ["customers", "accounting"]);
  };

  const persistPrefs = async (next: {
    defaultViewId?: string | null;
    teamQueueMode?: TeamQueueMode;
    savedViews?: ActionCenterSavedView[];
  }) => {
    if (!prefs) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveActionCenterPrefs({
        savedViews: next.savedViews ?? prefs.savedViews,
        defaultViewId: next.defaultViewId ?? prefs.defaultViewId,
        teamQueueMode: next.teamQueueMode ?? prefs.teamQueueMode,
        roleQueueOverrides: prefs.roleQueueOverrides,
      });
      await prefsQuery.refetch();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save Action Center preferences.");
    } finally {
      setSaving(false);
    }
  };

  const createSavedView = async () => {
    if (!prefs) return;
    const name = viewName.trim();
    if (!name) {
      setSaveError("View name is required.");
      return;
    }
    const next: ActionCenterSavedView = {
      id: uid("view"),
      name,
      query: viewQuery.trim(),
      modules: viewModules,
      teams: [],
      updatedAt: new Date().toISOString(),
    };
    await persistPrefs({ savedViews: [next, ...prefs.savedViews].slice(0, 30) });
  };

  if (prefsQuery.error) {
    return <ErrorPanel error={prefsQuery.error} title="Unable to load Action Center preferences" />;
  }

  if (queueQuery.error) {
    return <ErrorPanel error={queueQuery.error} title="Unable to load role-based queue" />;
  }

  return (
    <div className="stack">
      <PortalSearchPanel title="Cross-Portal Search" defaultModules={["customers", "accounting"]} />

      <div className="panel stack">
        <h1>Action Center</h1>
        <p className="muted">Server-backed saved views and role-based team queues for customer + accounting execution.</p>
        <div className="row">
          <span className="badge neutral">Role: {queueQuery.data?.role ?? "-"}</span>
          <span className="badge neutral">Effective queue mode: {queueQuery.data?.teamMode ?? "-"}</span>
          <Link to="/dms/accounting/inbox" className="uiButton uiButtonSecondary">
            Open Accounting Inbox
          </Link>
        </div>

        <div className="row">
          <button
            type="button"
            className={selectedMode === "role_default" ? "uiButton uiButtonPrimary" : "uiButton uiButtonSecondary"}
            onClick={() => {
              setSelectedMode("role_default");
              void persistPrefs({ teamQueueMode: "role_default" });
            }}
            disabled={saving}
          >
            Role Default
          </button>
          <button
            type="button"
            className={selectedMode === "customers" ? "uiButton uiButtonPrimary" : "uiButton uiButtonSecondary"}
            onClick={() => {
              setSelectedMode("customers");
              void persistPrefs({ teamQueueMode: "customers" });
            }}
            disabled={saving}
          >
            Customer Team
          </button>
          <button
            type="button"
            className={selectedMode === "accounting" ? "uiButton uiButtonPrimary" : "uiButton uiButtonSecondary"}
            onClick={() => {
              setSelectedMode("accounting");
              void persistPrefs({ teamQueueMode: "accounting" });
            }}
            disabled={saving}
          >
            Accounting Team
          </button>
          <button
            type="button"
            className={selectedMode === "hybrid" ? "uiButton uiButtonPrimary" : "uiButton uiButtonSecondary"}
            onClick={() => {
              setSelectedMode("hybrid");
              void persistPrefs({ teamQueueMode: "hybrid" });
            }}
            disabled={saving}
          >
            Hybrid Team
          </button>
        </div>
      </div>

      <div className="panel stack">
        <h2>Saved Views</h2>
        <div className="row">
          <input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="View name (e.g., Morning Ops)" />
          <input value={viewQuery} onChange={(event) => setViewQuery(event.target.value)} placeholder="Search filter for this view" />
          <button type="button" className={viewModules.includes("customers") ? "uiButton uiButtonPrimary" : "uiButton uiButtonSecondary"} onClick={() => toggleViewModule("customers")}>Customers</button>
          <button type="button" className={viewModules.includes("accounting") ? "uiButton uiButtonPrimary" : "uiButton uiButtonSecondary"} onClick={() => toggleViewModule("accounting")}>Accounting</button>
          <button type="button" onClick={() => void createSavedView()} disabled={saving}>Save View</button>
        </div>
        {saveError ? <p className="muted">{saveError}</p> : null}
        {prefs?.savedViews.length ? (
          <div className="stack">
            {prefs.savedViews.map((view) => (
              <div key={view.id} className="row">
                <strong>{view.name}</strong>
                <span className="muted">{view.query || "(no query)"}</span>
                <span className="badge neutral">{view.modules.join(", ")}</span>
                <button type="button" onClick={() => void applySavedView(view)}>Apply</button>
                <button type="button" onClick={() => void persistPrefs({ defaultViewId: view.id })} disabled={saving}>
                  {prefs?.defaultViewId === view.id ? "Default" : "Make Default"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No saved views yet.</p>
        )}
      </div>

      <div className="panel">
        <h2>Role-Based Queue</h2>
        <div className="row">
          <span className="badge warn">Customer tasks: {counts?.customerTasks ?? 0}</span>
          <span className="badge warn">Accounting approvals: {counts?.accountingApprovals ?? 0}</span>
          <span className="badge warn">Accounting exceptions: {counts?.accountingExceptions ?? 0}</span>
          <span className="badge warn">Accounting reviews: {counts?.accountingReviews ?? 0}</span>
        </div>
        {queueQuery.isLoading ? <p className="muted">Loading queue...</p> : null}
        {queueQuery.data?.items.length === 0 ? <p className="muted">No items in the current team queue.</p> : null}
        <div className="stack">
          {queueQuery.data?.items.map((item) => (
            <div key={item.id} className="row">
              <Link to={item.url}>{item.title}</Link>
              <span className="muted">{item.detail}</span>
              <span className="badge neutral">{item.module}</span>
              <span className="badge neutral">{item.queue}</span>
              <span className={`badge ${item.priority === "high" ? "warn" : "neutral"}`}>{item.priority}</span>
              <span className="badge neutral">{item.status}</span>
              {item.owner ? <span className="muted">owner: {item.owner}</span> : null}
              {item.dueAt ? <span className="muted">due: {new Date(item.dueAt).toLocaleDateString()}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
