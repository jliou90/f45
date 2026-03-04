import { useEffect, useMemo, useState } from "react";
import { useFeatureFlags } from "../../../app/use-feature-flags";
import { useToast } from "../../../app/use-toast";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { openPrintPreview } from "../../../lib/print";
import {
  getConversation,
  listConversations,
  postApprovalDecision,
  type ApprovalDecision,
  type ApprovalStatus,
  type Conversation,
} from "../api";

const STATUS_CLASS: Record<ApprovalStatus, string> = {
  "Pending approval": "badge warn",
  Approved: "badge ok",
  Rejected: "badge danger",
  "Needs follow-up": "badge neutral",
};

function downloadConversation(conversation: Conversation) {
  const blob = new Blob([JSON.stringify(conversation, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${conversation.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CommsPage() {
  const toast = useToast();
  const featureFlags = useFeatureFlags();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [actionBusy, setActionBusy] = useState<ApprovalDecision | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const items = await listConversations();
        if (cancelled) return;
        setConversations(items);
        const targetId = selectedId ?? items[0]?.id ?? null;
        setSelectedId(targetId);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSelected() {
      if (!selectedId) {
        setSelectedConversation(null);
        return;
      }
      try {
        const item = await getConversation(selectedId);
        if (!cancelled) {
          setSelectedConversation(item);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError);
        }
      }
    }
    void loadSelected();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = useMemo(() => {
    if (!selectedConversation) return null;
    return selectedConversation;
  }, [selectedConversation]);

  const runDecision = async (decision: ApprovalDecision) => {
    if (!selected) return;
    setActionBusy(decision);
    try {
      const result = await postApprovalDecision(selected.id, decision);
      const refreshed = await getConversation(selected.id);
      setSelectedConversation(refreshed);
      setConversations((current) => current.map((item) => (item.id === refreshed.id ? refreshed : item)));
      if (result.queued) {
        toast.pushToast("success", `Action queued offline (${result.request_id}).`);
      } else {
        toast.pushToast("success", `Action saved (${result.request_id}).`);
      }
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Comms action failed.");
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <h1>Comms</h1>
        <p className="muted">Quote approvals with timeline and audit context.</p>
      </section>

      <section className="panel commsLayout">
        <aside className="commsList" aria-label="Conversation list">
          <h2>Conversations</h2>
          {loading ? <p>Loading conversations...</p> : null}
          <ul>
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={conversation.id === selectedId ? "conversationCard active" : "conversationCard"}
                  onClick={() => setSelectedId(conversation.id)}
                  aria-label={`Open ${conversation.customerName} conversation`}
                >
                  <div>
                    <strong>{conversation.customerName}</strong>
                    <div className="muted">{conversation.vehicle}</div>
                  </div>
                  <span className={STATUS_CLASS[conversation.status]}>{conversation.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <article className="commsDetail" aria-label="Conversation details">
          {!selected ? <p className="muted">Select a conversation.</p> : null}
          {selected ? (
            <>
              <header className="row commsHeader">
                <div>
                  <h2>{selected.customerName}</h2>
                  <div className="muted">
                    {selected.vehicle} | request_id: <code>{selected.request_id}</code>
                  </div>
                </div>
                <button type="button" onClick={() => downloadConversation(selected)}>
                  Export conversation
                </button>
                {featureFlags.flags.pdfExportEnabled ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        openPrintPreview("repair-order", {
                          customerName: selected.customerName,
                          vehicle: selected.vehicle,
                          status: selected.status,
                          latestMessageAt: selected.latestMessageAt,
                          request_id: selected.request_id,
                        })
                      }
                    >
                      Print Repair Order
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openPrintPreview("quote", {
                          customerName: selected.customerName,
                          vehicle: selected.vehicle,
                          status: selected.status,
                          latestMessageAt: selected.latestMessageAt,
                          request_id: selected.request_id,
                        })
                      }
                    >
                      Print Quote
                    </button>
                  </>
                ) : null}
              </header>

              <div className="timeline">
                {selected.messages.map((message) => (
                  <div key={message.id} className="timelineItem">
                    <div className="muted">
                      {new Date(message.createdAt).toLocaleString()} | {message.author}
                    </div>
                    <p>{message.body}</p>
                    <div className="muted">
                      request_id: <code>{message.request_id}</code>
                    </div>
                  </div>
                ))}
              </div>

              <div className="row">
                <button
                  type="button"
                  onClick={() => void runDecision("request")}
                  disabled={Boolean(actionBusy)}
                  aria-label="Request approval"
                >
                  {actionBusy === "request" ? "Submitting..." : "Request Approval"}
                </button>
                <button
                  type="button"
                  onClick={() => void runDecision("approve")}
                  disabled={Boolean(actionBusy)}
                  aria-label="Approve conversation"
                >
                  {actionBusy === "approve" ? "Approving..." : "Approve"}
                </button>
                <button
                  type="button"
                  className="dangerButton"
                  onClick={() => void runDecision("reject")}
                  disabled={Boolean(actionBusy)}
                  aria-label="Reject conversation"
                >
                  {actionBusy === "reject" ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </>
          ) : null}
        </article>
      </section>

      {error ? <ErrorPanel error={error} title="Comms unavailable" /> : null}
    </div>
  );
}

