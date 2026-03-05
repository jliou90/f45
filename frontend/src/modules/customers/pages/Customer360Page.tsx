import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import { buildDuplicateCandidates, getCustomerProfile, listCustomerLinkedWork, listCustomerSummaries } from "../api";

function daysSince(iso: string): number {
  if (!iso) return 999;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 999;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

export function Customer360Page() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId || "";

  const profileQuery = useQuery(() => getCustomerProfile(itemId), {
    enabled: Boolean(itemId),
    deps: [itemId],
  });

  const summariesQuery = useQuery(() => listCustomerSummaries(""), {
    enabled: Boolean(itemId),
    deps: [itemId],
  });

  const linkedWorkQuery = useQuery(
    () => (profileQuery.data ? listCustomerLinkedWork(profileQuery.data) : Promise.resolve({ openDeals: [], openService: [] })),
    {
      enabled: Boolean(profileQuery.data),
      deps: [profileQuery.data?.id, profileQuery.data?.firstName, profileQuery.data?.lastName],
    },
  );

  const metrics = useMemo(() => {
    if (!profileQuery.data) return null;
    const p = profileQuery.data;
    const profileFields = [p.firstName, p.lastName, p.phone, p.email, p.address1, p.city, p.state, p.zip, p.dmsCustomerId];
    const completed = profileFields.filter((value) => value && value.trim().length > 0).length;
    const completeness = Math.round((completed / profileFields.length) * 100);

    const recentComms = p.communications.length > 0 ? p.communications[0].happenedAt : "";
    const recencyDays = daysSince(recentComms);
    const engagementRaw =
      Math.min(40, p.notes.length * 4) +
      Math.min(40, p.communications.length * 3) +
      Math.min(20, p.tasks.filter((task) => task.status !== "done").length * 4);
    const engagement = Math.max(0, Math.min(100, engagementRaw - Math.min(30, recencyDays)));

    const duplicates = summariesQuery.data ? buildDuplicateCandidates(p, summariesQuery.data) : [];

    return {
      completeness,
      engagement,
      recencyDays,
      duplicates,
      openTasks: p.tasks.filter((task) => task.status !== "done").length,
      garageCount: p.garage.length,
      attachmentCount: p.attachments.length,
    };
  }, [profileQuery.data, summariesQuery.data]);

  if (profileQuery.isLoading) {
    return <div className="panel">Loading customer 360...</div>;
  }

  if (profileQuery.error) {
    return <ErrorPanel error={profileQuery.error} title="Unable to load customer 360" />;
  }

  if (!profileQuery.data || !metrics) {
    return <div className="panel">Customer not found.</div>;
  }

  return (
    <div className="stack">
      <div className="panel">
        <h1>Customer 360</h1>
        <p className="muted">Unified profile, engagement, duplicate risk, and linked operations for this customer.</p>
        <div className="row">
          <Link to={`/dms/customers/${profileQuery.data.id}`} className="uiButton uiButtonSecondary">
            Open Profile
          </Link>
          <Link to={`/dms/customers/${profileQuery.data.id}/edit`} className="uiButton uiButtonPrimary">
            Edit Customer
          </Link>
        </div>
      </div>

      <div className="panel stack">
        <h2>Health Scores</h2>
        <div className="row">
          <span className="badge neutral">Profile completeness: {metrics.completeness}%</span>
          <span className="badge neutral">Engagement score: {metrics.engagement}/100</span>
          <span className="badge neutral">Open tasks: {metrics.openTasks}</span>
          <span className="badge neutral">Garage: {metrics.garageCount}</span>
          <span className="badge neutral">Attachments: {metrics.attachmentCount}</span>
          <span className="badge neutral">Last comms age: {metrics.recencyDays} days</span>
        </div>
      </div>

      <div className="panel stack">
        <h2>Duplicate Risk</h2>
        {metrics.duplicates.length === 0 ? <p className="muted">No high-confidence duplicates detected.</p> : null}
        {metrics.duplicates.slice(0, 8).map((candidate) => (
          <div key={candidate.id} className="row">
            <Link to={`/dms/customers/${candidate.id}`}>{candidate.name || candidate.id}</Link>
            <span className="muted">{candidate.primaryPhone || candidate.primaryEmail || "No contact"}</span>
            <span className="badge warn">Potential Duplicate</span>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>Linked Work</h2>
        <span className="badge neutral">Open deals: {linkedWorkQuery.data?.openDeals.length ?? 0}</span>
        <span className="badge neutral">Open service ROs: {linkedWorkQuery.data?.openService.length ?? 0}</span>
        {(linkedWorkQuery.data?.openDeals.length ?? 0) > 0 ? (
          <div className="stack">
            {linkedWorkQuery.data?.openDeals.map((deal) => (
              <div key={deal.id} className="row">
                <Link to={`/dms/sales/${deal.id}`}>{deal.id}</Link>
                <span className="badge neutral">{deal.state}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
