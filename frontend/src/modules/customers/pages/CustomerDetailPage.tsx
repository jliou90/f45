import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import {
  buildDuplicateCandidates,
  buildTimeline,
  getCustomerProfile,
  listCustomerAuditEntries,
  listCustomerLinkedWork,
  listCustomerSummaries,
  mergeCustomers,
  type CustomerTimelineEntry,
} from "../api";

export function CustomerDetailPage() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId || "";

  const profileQuery = useQuery(() => getCustomerProfile(itemId), {
    enabled: Boolean(itemId),
    deps: [itemId],
  });

  const auditQuery = useQuery(() => listCustomerAuditEntries(itemId), {
    enabled: Boolean(itemId),
    deps: [itemId],
  });

  const summariesQuery = useQuery(() => listCustomerSummaries(""), {
    enabled: Boolean(itemId),
    deps: [itemId],
  });

  const linkedWorkQuery = useQuery(() => (profileQuery.data ? listCustomerLinkedWork(profileQuery.data) : Promise.resolve({ openDeals: [], openService: [] })), {
    enabled: Boolean(profileQuery.data),
    deps: [profileQuery.data?.id, profileQuery.data?.firstName, profileQuery.data?.lastName],
  });

  const [timelineFilter, setTimelineFilter] = useState<"all" | "note" | "communication" | "task" | "audit">("all");
  const [mergeError, setMergeError] = useState<unknown>(null);
  const [mergingId, setMergingId] = useState<string>("");

  const duplicates = useMemo(() => {
    if (!profileQuery.data || !summariesQuery.data) return [];
    return buildDuplicateCandidates(profileQuery.data, summariesQuery.data);
  }, [profileQuery.data, summariesQuery.data]);

  const timeline = useMemo(() => {
    if (!profileQuery.data || !auditQuery.data) return [] as CustomerTimelineEntry[];
    const all = buildTimeline(profileQuery.data, auditQuery.data);
    if (timelineFilter === "all") return all;
    return all.filter((entry) => entry.type === timelineFilter);
  }, [auditQuery.data, profileQuery.data, timelineFilter]);

  const onMerge = async (sourceId: string) => {
    if (!profileQuery.data) return;
    setMergeError(null);
    setMergingId(sourceId);
    try {
      const source = await getCustomerProfile(sourceId);
      await mergeCustomers({ target: profileQuery.data, source });
      await profileQuery.refetch();
      await summariesQuery.refetch();
    } catch (error) {
      setMergeError(error);
    } finally {
      setMergingId("");
    }
  };

  return (
    <div className="panel">
      <h1>Customer Profile</h1>
      {profileQuery.isLoading ? <p>Loading...</p> : null}
      {profileQuery.data ? (
        <>
          <p>
            <strong>DMS Customer ID:</strong> {profileQuery.data.dmsCustomerId || "-"}
          </p>
          <p>
            <strong>Name:</strong> {profileQuery.data.firstName} {profileQuery.data.lastName}
          </p>
          <p>
            <strong>Primary Phone:</strong> {profileQuery.data.phone || profileQuery.data.phones[0]?.number || "-"}
          </p>
          <p>
            <strong>Primary Email:</strong> {profileQuery.data.email || profileQuery.data.emails[0]?.email || "-"}
          </p>
          <p>
            <strong>Address:</strong> {[profileQuery.data.address1, profileQuery.data.address2, profileQuery.data.city, profileQuery.data.state, profileQuery.data.zip].filter(Boolean).join(", ") || "-"}
          </p>

          <h2>Deal/Service Linkage</h2>
          <p>
            <strong>Open Deals:</strong> {linkedWorkQuery.data?.openDeals.length ?? 0}
          </p>
          <p>
            <strong>Open Service ROs:</strong> {linkedWorkQuery.data?.openService.length ?? 0}
          </p>
          {(linkedWorkQuery.data?.openDeals.length ?? 0) > 0 ? (
            <ul>
              {linkedWorkQuery.data?.openDeals.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link to={`/dms/sales/${item.id}`}>{item.id}</Link> - {item.state}
                </li>
              ))}
            </ul>
          ) : null}

          <h2>Duplicate Detection</h2>
          {duplicates.length > 0 ? (
            <ul>
              {duplicates.slice(0, 5).map((candidate) => (
                <li key={candidate.id}>
                  {candidate.name} ({candidate.primaryPhone || candidate.primaryEmail || candidate.id})
                  <button type="button" disabled={mergingId === candidate.id} onClick={() => void onMerge(candidate.id)}>
                    {mergingId === candidate.id ? "Merging..." : "Merge Into This Customer"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No likely duplicates found.</p>
          )}

          <h2>Household</h2>
          <p>
            <strong>Household ID:</strong> {profileQuery.data.household.householdId || "-"}
          </p>
          <p>
            <strong>Relationship:</strong> {profileQuery.data.household.relationship || "-"}
          </p>
          <p>
            <strong>Linked Customer IDs:</strong> {profileQuery.data.household.linkedCustomerIds.join(", ") || "-"}
          </p>

          <h2>Spouse</h2>
          <p>
            <strong>Name:</strong> {[profileQuery.data.spouse.firstName, profileQuery.data.spouse.lastName].filter(Boolean).join(" ") || "-"}
          </p>
          <p>
            <strong>Phone:</strong> {profileQuery.data.spouse.phone || "-"}
          </p>
          <p>
            <strong>Email:</strong> {profileQuery.data.spouse.email || "-"}
          </p>

          <h2>Garage</h2>
          {profileQuery.data.garage.length > 0 ? (
            <ul>
              {profileQuery.data.garage.map((vehicle) => (
                <li key={vehicle.id}>
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")} {vehicle.vin ? `(${vehicle.vin})` : ""} {vehicle.nickname ? `- ${vehicle.nickname}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No garage records.</p>
          )}

          <h2>Tasks & Reminders</h2>
          {profileQuery.data.tasks.length > 0 ? (
            <ul>
              {profileQuery.data.tasks.map((task) => (
                <li key={task.id}>
                  {task.title} ({task.status}) {task.dueAt ? `- ${new Date(task.dueAt).toLocaleString()}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No tasks.</p>
          )}

          <h2>Attachments</h2>
          {profileQuery.data.attachments.length > 0 ? (
            <ul>
              {profileQuery.data.attachments.map((attachment) => (
                <li key={attachment.attachmentId}>
                  <a href={`/api/v1/docs/attachments/${encodeURIComponent(attachment.attachmentId)}/download`} target="_blank" rel="noreferrer">{attachment.filename}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No attachments.</p>
          )}

          <h2>Timeline</h2>
          <div className="row">
            <button type="button" onClick={() => setTimelineFilter("all")}>All</button>
            <button type="button" onClick={() => setTimelineFilter("note")}>Notes</button>
            <button type="button" onClick={() => setTimelineFilter("communication")}>Comms</button>
            <button type="button" onClick={() => setTimelineFilter("task")}>Tasks</button>
            <button type="button" onClick={() => setTimelineFilter("audit")}>Audit</button>
          </div>
          {timeline.length > 0 ? (
            <ul>
              {timeline.slice(0, 50).map((entry) => (
                <li key={entry.id}>
                  {new Date(entry.happenedAt).toLocaleString()} - [{entry.type}] {entry.title} - {entry.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No timeline entries for selected filter.</p>
          )}

          <p>
            <Link to={`/dms/customers/${profileQuery.data.id}/overview`}>Customer 360</Link>
          </p>
          <p>
            <Link to={`/dms/customers/${profileQuery.data.id}/edit`}>Edit</Link>
          </p>
        </>
      ) : null}
      {profileQuery.error ? <ErrorPanel error={profileQuery.error} title="Customer unavailable" /> : null}
      {auditQuery.error ? <ErrorPanel error={auditQuery.error} title="Audit unavailable" /> : null}
      {mergeError ? <ErrorPanel error={mergeError} title="Merge failed" /> : null}
    </div>
  );
}
