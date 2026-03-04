import { useState } from "react";
import { useToast } from "../../../app/use-toast";
import { ErrorPanel } from "../../../components/ErrorPanel";
import {
  listCustomerEmails,
  sendCustomerEmail,
  sendFundingStip,
  type OutboundCommunication,
  uploadCommsAttachment,
} from "../api";

export function CommsOutboundPage() {
  const toast = useToast();
  const [customerId, setCustomerId] = useState("");
  const [customerToEmail, setCustomerToEmail] = useState("");
  const [customerSubject, setCustomerSubject] = useState("");
  const [customerBody, setCustomerBody] = useState("");
  const [dealId, setDealId] = useState("");
  const [lenderEmail, setLenderEmail] = useState("");
  const [stipName, setStipName] = useState("");
  const [stipNote, setStipNote] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState<"customer" | "stip" | null>(null);
  const [customerHistory, setCustomerHistory] = useState<OutboundCommunication[]>([]);
  const [error, setError] = useState<unknown>(null);

  const refreshCustomerHistory = async () => {
    if (!customerId.trim()) return;
    try {
      const items = await listCustomerEmails(customerId.trim());
      setCustomerHistory(items);
    } catch (nextError) {
      setError(nextError);
    }
  };

  const onUploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadCommsAttachment(file);
      setAttachmentId(uploaded.id);
      toast.pushToast("success", `Uploaded attachment ${uploaded.filename}`);
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Attachment upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const onSendCustomerEmail = async () => {
    if (!customerId.trim() || !customerToEmail.trim() || !customerSubject.trim() || !customerBody.trim()) {
      toast.pushToast("error", "Customer email form is incomplete.");
      return;
    }
    setSending("customer");
    try {
      await sendCustomerEmail({
        customerId: customerId.trim(),
        toEmail: customerToEmail.trim(),
        subject: customerSubject.trim(),
        body: customerBody.trim(),
        attachmentId: attachmentId.trim() || undefined,
      });
      toast.pushToast("success", "Customer email submitted.");
      await refreshCustomerHistory();
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Customer email failed.");
    } finally {
      setSending(null);
    }
  };

  const onSendFundingStip = async () => {
    if (!dealId.trim() || !lenderEmail.trim() || !stipName.trim() || !attachmentId.trim()) {
      toast.pushToast("error", "Funding stip form is incomplete.");
      return;
    }
    setSending("stip");
    try {
      await sendFundingStip({
        dealId: dealId.trim(),
        lenderEmail: lenderEmail.trim(),
        stipName: stipName.trim(),
        attachmentId: attachmentId.trim(),
        note: stipNote.trim() || undefined,
      });
      toast.pushToast("success", "Funding stip sent.");
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Funding stip send failed.");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="panel stack">
      <h1>Comms Outbound</h1>
      <p className="muted">Dedicated outbound messaging: customer contact logs and lender stip delivery.</p>
      <div className="row">
        <label>
          Attachment upload
          <input type="file" onChange={(event) => void onUploadAttachment(event)} disabled={uploading} />
        </label>
        <label>
          Attachment ID
          <input value={attachmentId} onChange={(event) => setAttachmentId(event.target.value)} placeholder="Attachment UUID" />
        </label>
      </div>
      <div className="row">
        <div className="stack" style={{ flex: 1 }}>
          <h2>Customer Email</h2>
          <label>
            Customer ID
            <input value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
          </label>
          <label>
            To Email
            <input value={customerToEmail} onChange={(event) => setCustomerToEmail(event.target.value)} />
          </label>
          <label>
            Subject
            <input value={customerSubject} onChange={(event) => setCustomerSubject(event.target.value)} />
          </label>
          <label>
            Body
            <textarea value={customerBody} onChange={(event) => setCustomerBody(event.target.value)} rows={4} />
          </label>
          <div className="row">
            <button type="button" onClick={() => void onSendCustomerEmail()} disabled={sending !== null}>
              {sending === "customer" ? "Sending..." : "Send Customer Email"}
            </button>
            <button type="button" onClick={() => void refreshCustomerHistory()} disabled={!customerId.trim()}>
              Refresh History
            </button>
          </div>
          {customerHistory.length > 0 ? (
            <ul>
              {customerHistory.slice(0, 10).map((item) => (
                <li key={item.id}>
                  {new Date(item.created_at).toLocaleString()} - {item.to_address} - {item.status}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No customer comms loaded.</p>
          )}
        </div>
        <div className="stack" style={{ flex: 1 }}>
          <h2>Funding Stip Delivery</h2>
          <label>
            Deal ID
            <input value={dealId} onChange={(event) => setDealId(event.target.value)} />
          </label>
          <label>
            Lender Email
            <input value={lenderEmail} onChange={(event) => setLenderEmail(event.target.value)} />
          </label>
          <label>
            Stip Name
            <input value={stipName} onChange={(event) => setStipName(event.target.value)} />
          </label>
          <label>
            Note
            <textarea value={stipNote} onChange={(event) => setStipNote(event.target.value)} rows={4} />
          </label>
          <button type="button" onClick={() => void onSendFundingStip()} disabled={sending !== null}>
            {sending === "stip" ? "Sending..." : "Send Stip to Lender"}
          </button>
        </div>
      </div>
      {error ? <ErrorPanel error={error} title="Outbound comms unavailable" /> : null}
    </div>
  );
}

