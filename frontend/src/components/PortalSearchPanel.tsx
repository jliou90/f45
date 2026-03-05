import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "../lib/query";
import { loadSavedPortalSearches, savePortalSearchQuery, searchPortal, type PortalSearchModule } from "../modules/portal-search/api";

type PortalSearchPanelProps = {
  title?: string;
  defaultModules?: PortalSearchModule[];
};

export function PortalSearchPanel({ title = "Portal Search", defaultModules = ["customers", "accounting"] }: PortalSearchPanelProps) {
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [modules, setModules] = useState<PortalSearchModule[]>(defaultModules);
  const [nonce, setNonce] = useState(0);
  const [savedQueries, setSavedQueries] = useState<string[]>(() => loadSavedPortalSearches());

  const searchQuery = useQuery(() => searchPortal(query, { modules, limit: 10 }), {
    enabled: nonce > 0,
    deps: [query, modules.join(","), nonce],
  });

  const toggleModule = (module: PortalSearchModule) => {
    setModules((current) => {
      if (current.includes(module)) {
        const next = current.filter((item) => item !== module);
        return next.length > 0 ? next : current;
      }
      return [...current, module];
    });
  };

  return (
    <div className="panel stack">
      <div className="sectionHeader">
        <h2>{title}</h2>
        <Link to="/dms/action-center" className="uiButton uiButtonSecondary">
          Open Action Center
        </Link>
      </div>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(queryDraft);
          savePortalSearchQuery(queryDraft);
          setSavedQueries(loadSavedPortalSearches());
          setNonce((value) => value + 1);
        }}
      >
        <input
          aria-label="Search portal"
          value={queryDraft}
          onChange={(event) => setQueryDraft(event.target.value)}
          placeholder="Search customers + accounting"
        />
        <button type="submit">Search</button>
      </form>
      {savedQueries.length > 0 ? (
        <div className="row">
          {savedQueries.slice(0, 6).map((item) => (
            <button
              key={item}
              type="button"
              className="uiButton uiButtonSecondary"
              onClick={() => {
                setQueryDraft(item);
                setQuery(item);
                setNonce((value) => value + 1);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      <div className="row">
        <button type="button" className={modules.includes("customers") ? "uiButton uiButtonPrimary" : "uiButton uiButtonSecondary"} onClick={() => toggleModule("customers")}>Customers</button>
        <button type="button" className={modules.includes("accounting") ? "uiButton uiButtonPrimary" : "uiButton uiButtonSecondary"} onClick={() => toggleModule("accounting")}>Accounting</button>
        {searchQuery.data ? (
          <>
            <span className="badge neutral">Customers: {searchQuery.data.facets.customers}</span>
            <span className="badge neutral">Accounting: {searchQuery.data.facets.accounting}</span>
          </>
        ) : null}
      </div>
      {searchQuery.isLoading ? <p className="muted">Searching...</p> : null}
      {searchQuery.data && searchQuery.data.items.length > 0 ? (
        <div className="stack">
          {searchQuery.data.items.map((item) => (
            <Link key={`${item.module}:${item.entityId}`} to={item.url} className="portalSearchItem">
              <div>
                <strong>{item.title}</strong>
                <div className="muted">{item.subtitle || item.module}</div>
              </div>
              <div className="row">
                <span className="badge neutral">{item.module}</span>
                <span className="badge neutral">{item.status || "active"}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
      {searchQuery.data && searchQuery.data.items.length === 0 ? <p className="muted">No cross-portal matches.</p> : null}
    </div>
  );
}
