import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../../../components/DataTable";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { PortalSearchPanel } from "../../../components/PortalSearchPanel";
import { useQuery } from "../../../lib/query";
import { getCustomerProfile, searchCustomerSummaries, updateCustomerProfile } from "../api";

type CsvPreviewRow = {
  id: string;
  phone: string;
  email: string;
  dmsCustomerId: string;
};

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsv(text: string): CsvPreviewRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((x) => x.trim().toLowerCase());
  const idxId = header.indexOf("id");
  const idxPhone = header.indexOf("phone");
  const idxEmail = header.indexOf("email");
  const idxDms = header.indexOf("dmscustomerid");
  if (idxId < 0) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((x) => x.trim());
    return {
      id: cols[idxId] || "",
      phone: idxPhone >= 0 ? cols[idxPhone] || "" : "",
      email: idxEmail >= 0 ? cols[idxEmail] || "" : "",
      dmsCustomerId: idxDms >= 0 ? cols[idxDms] || "" : "",
    };
  }).filter((row) => row.id.length > 0);
}

export function CustomerListPage() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchNonce, setSearchNonce] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [importPreview, setImportPreview] = useState<CsvPreviewRow[]>([]);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const query = useQuery(() => searchCustomerSummaries(search, { page, size: pageSize }), {
    enabled: hasSearched,
    deps: [search, searchNonce, page],
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exportCsv = () => {
    if (!query.data) return;
    const header = ["id", "name", "phone", "email", "dmsCustomerId", "householdId"];
    const rows = query.data.items.map((row) => [row.id, row.name, row.primaryPhone, row.primaryEmail, row.dmsCustomerId, row.householdId]);
    const csv = [header, ...rows].map((line) => line.map((value) => csvEscape(value || "")).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onImportCsv = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const text = await files[0].text();
    setImportPreview(parseCsv(text));
  };

  const applyBulkUpdate = async () => {
    if (importPreview.length === 0) return;
    setBulkRunning(true);
    setBulkMessage("");
    try {
      let applied = 0;
      for (const row of importPreview) {
        const profile = await getCustomerProfile(row.id);
        await updateCustomerProfile(
          row.id,
          {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: row.email || profile.email,
            phone: row.phone || profile.phone,
            address1: profile.address1,
            address2: profile.address2,
            city: profile.city,
            state: profile.state,
            zip: profile.zip,
            dmsCustomerId: row.dmsCustomerId || profile.dmsCustomerId,
            phones: profile.phones,
            emails: profile.emails,
            spouse: profile.spouse,
            household: profile.household,
            garage: profile.garage,
            notes: profile.notes,
            communications: profile.communications,
            tasks: profile.tasks,
            attachments: profile.attachments,
          },
          { customerVersion: profile.version, crmVersion: profile.crmVersion },
        );
        applied += 1;
      }
      setBulkMessage(`Bulk update complete: ${applied} customer(s) updated.`);
      setImportPreview([]);
      await query.refetch();
    } catch (error) {
      setBulkMessage(`Bulk update failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <div className="stack">
      <PortalSearchPanel title="Smart Search" defaultModules={["customers", "accounting"]} />
      <div className="panel">
      <h1>Customer CRM</h1>
      <p className="muted">Profiles, households, spouse details, garage records, notes, and communication logs.</p>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          setHasSearched(true);
          setPage(1);
          setSearch(searchDraft.trim());
          setSearchNonce((prev) => prev + 1);
        }}
      >
        <input
          ref={searchInputRef}
          aria-label="Search customers"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Search by name, DMS ID, phone, email, household, spouse"
        />
        <button type="submit">Search</button>
        <button type="button" onClick={exportCsv} disabled={!query.data || query.data.items.length === 0}>
          Export CSV
        </button>
        <Link to="/dms/customers/new" className="uiButton uiButtonPrimary" style={{ textDecoration: "none" }}>
          Create Customer
        </Link>
      </form>

      {!hasSearched ? <p className="muted">Enter a search and press `Search` (or Enter) to load results.</p> : null}
      {hasSearched && query.isLoading ? <p>Loading...</p> : null}
      {query.error ? <ErrorPanel error={query.error} title="Customer search failed" /> : null}
      {hasSearched && !query.isLoading && !query.error && query.data && query.data.items.length === 0 ? <p className="muted">No customers matched your search.</p> : null}

      {query.data && query.data.items.length > 0 ? (
        <>
          <div className="row">
            <span className="badge neutral">{query.data.total} total matches</span>
            <span className="badge neutral">
              Page {query.data.page} of {Math.max(1, Math.ceil(query.data.total / query.data.size))}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={query.data.page <= 1 || query.isLoading}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={query.isLoading || query.data.page * query.data.size >= query.data.total}
            >
              Next
            </button>
          </div>
        <DataTable
          rows={query.data.items}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "dmsCustomerId",
              header: "DMS ID",
              render: (row) => (row.dmsCustomerId ? row.dmsCustomerId : "-") as string,
            },
            {
              key: "name",
              header: "Name",
              render: (row) => (
                <div className="row">
                  <Link to={`/dms/customers/${row.id}`}>{row.name || row.id}</Link>
                  <Link to={`/dms/customers/${row.id}/overview`} className="uiButton uiButtonSecondary">
                    360
                  </Link>
                </div>
              ),
            },
            { key: "primaryPhone", header: "Phone", render: (row) => row.primaryPhone || "-" },
            { key: "primaryEmail", header: "Email", render: (row) => row.primaryEmail || "-" },
            { key: "householdId", header: "Household", render: (row) => row.householdId || "-" },
            { key: "garageCount", header: "Garage", render: (row) => String(row.garageCount) },
            { key: "notesCount", header: "Notes", render: (row) => String(row.notesCount) },
            {
              key: "lastCommunicationAt",
              header: "Last Comms",
              render: (row) => (row.lastCommunicationAt ? new Date(row.lastCommunicationAt).toLocaleString() : "-") as string,
            },
          ]}
        />
        </>
      ) : null}

      <div className="stack">
        <h2>Bulk Import/Update</h2>
        <p className="muted">CSV columns supported for update: `id,phone,email,dmsCustomerId`.</p>
        <input type="file" accept=".csv,text/csv" onChange={(event) => void onImportCsv(event.target.files)} />
        {importPreview.length > 0 ? (
          <>
            <p>{importPreview.length} row(s) ready.</p>
            <button type="button" onClick={() => void applyBulkUpdate()} disabled={bulkRunning}>
              {bulkRunning ? "Applying..." : "Apply Bulk Update"}
            </button>
          </>
        ) : null}
        {bulkMessage ? <p className="muted">{bulkMessage}</p> : null}
      </div>
      </div>
    </div>
  );
}
