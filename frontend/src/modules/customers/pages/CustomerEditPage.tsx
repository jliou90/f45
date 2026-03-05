import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import {
  communicationDraft,
  createDmsCustomerId,
  getCustomerProfile,
  noteDraft,
  rowId,
  uploadCustomerAttachment,
  type CommunicationEntry,
  type ContactEmail,
  type ContactPhone,
  type CustomerProfileInput,
  type CustomerTask,
  type GarageVehicle,
  updateCustomerProfile,
} from "../api";

function toDateTimeLocalInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function dateTimeLocalToIso(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

export function CustomerEditPage() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId || "";
  const query = useQuery(() => getCustomerProfile(itemId), {
    enabled: Boolean(itemId),
    deps: [itemId],
  });

  const [form, setForm] = useState<CustomerProfileInput | null>(null);
  const [hydratedId, setHydratedId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saveNotice, setSaveNotice] = useState("");

  const [noteText, setNoteText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [taskDraft, setTaskDraft] = useState<CustomerTask>({
    id: rowId("task"),
    title: "",
    dueAt: "",
    status: "open",
    owner: "",
    notes: "",
  });
  const [commDraft, setCommDraft] = useState<Omit<CommunicationEntry, "id">>({
    channel: "phone",
    direction: "outbound",
    subject: "",
    summary: "",
    happenedAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (!query.data || hydratedId === query.data.id) return;
    setForm({
      firstName: query.data.firstName,
      lastName: query.data.lastName,
      email: query.data.email,
      phone: query.data.phone,
      address1: query.data.address1,
      address2: query.data.address2,
      city: query.data.city,
      state: query.data.state,
      zip: query.data.zip,
      dmsCustomerId: query.data.dmsCustomerId,
      phones: query.data.phones,
      emails: query.data.emails,
      spouse: query.data.spouse,
      household: query.data.household,
      garage: query.data.garage,
      notes: query.data.notes,
      communications: query.data.communications,
      tasks: query.data.tasks,
      attachments: query.data.attachments,
    });
    setHydratedId(query.data.id);
  }, [hydratedId, query.data]);

  const linkedIdsText = useMemo(() => form?.household.linkedCustomerIds.join(", ") ?? "", [form?.household.linkedCustomerIds]);

  const updatePhone = (index: number, patch: Partial<ContactPhone>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const phones = [...prev.phones];
      phones[index] = { ...phones[index], ...patch };
      if (patch.primary) {
        for (let i = 0; i < phones.length; i += 1) {
          if (i !== index) phones[i] = { ...phones[i], primary: false };
        }
      }
      return { ...prev, phones };
    });
  };

  const updateEmail = (index: number, patch: Partial<ContactEmail>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const emails = [...prev.emails];
      emails[index] = { ...emails[index], ...patch };
      if (patch.primary) {
        for (let i = 0; i < emails.length; i += 1) {
          if (i !== index) emails[i] = { ...emails[i], primary: false };
        }
      }
      return { ...prev, emails };
    });
  };

  const updateGarage = (index: number, patch: Partial<GarageVehicle>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const garage = [...prev.garage];
      garage[index] = { ...garage[index], ...patch };
      return { ...prev, garage };
    });
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, notes: [noteDraft(noteText.trim()), ...prev.notes] };
    });
    setNoteText("");
  };

  const addTask = () => {
    if (!taskDraft.title.trim()) return;
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, tasks: [{ ...taskDraft, id: rowId("task") }, ...prev.tasks] };
    });
    setTaskDraft({ id: rowId("task"), title: "", dueAt: "", status: "open", owner: "", notes: "" });
  };

  const addCommunication = () => {
    if (!commDraft.summary.trim()) return;
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        communications: [
          communicationDraft({
            ...commDraft,
            subject: commDraft.subject.trim(),
            summary: commDraft.summary.trim(),
            happenedAt: commDraft.happenedAt || new Date().toISOString(),
          }),
          ...prev.communications,
        ],
      };
    });
    setCommDraft({
      channel: "phone",
      direction: "outbound",
      subject: "",
      summary: "",
      happenedAt: new Date().toISOString(),
    });
  };

  const onUploadAttachment = async (files: FileList | null) => {
    if (!files || files.length === 0 || !form || !itemId) return;
    const file = files[0];
    setUploading(true);
    setSaveError(null);
    try {
      const attachment = await uploadCustomerAttachment(itemId, file);
      setForm((prev) => (prev ? { ...prev, attachments: [attachment, ...prev.attachments] } : prev));
      setSaveNotice(`Uploaded ${file.name}`);
    } catch (nextError) {
      setSaveError(nextError);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !itemId) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice("");
    try {
      await updateCustomerProfile(itemId, form, {
        customerVersion: query.data?.version,
        crmVersion: query.data?.crmVersion,
      });
      setSaveNotice(`Saved ${new Date().toLocaleTimeString()}`);
      await query.refetch();
    } catch (nextError) {
      setSaveError(nextError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h1>Edit Customer CRM</h1>
      {query.isLoading || !form ? <p>Loading...</p> : null}
      {form ? (
        <form onSubmit={(event) => void onSubmit(event)} className="stack">
          <h2>Profile</h2>
          <div className="row">
            <label>
              First Name
              <input value={form.firstName} onChange={(event) => setForm((prev) => (prev ? { ...prev, firstName: event.target.value } : prev))} required />
            </label>
            <label>
              Last Name
              <input value={form.lastName} onChange={(event) => setForm((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))} required />
            </label>
          </div>
          <label>
            DMS Customer ID
            <div className="row">
              <input value={form.dmsCustomerId} onChange={(event) => setForm((prev) => (prev ? { ...prev, dmsCustomerId: event.target.value } : prev))} />
              <button type="button" onClick={() => setForm((prev) => (prev ? { ...prev, dmsCustomerId: createDmsCustomerId(prev.lastName) } : prev))}>
                Generate
              </button>
            </div>
          </label>

          <div className="row">
            <label>
              Primary Phone
              <input value={form.phone} onChange={(event) => setForm((prev) => (prev ? { ...prev, phone: event.target.value } : prev))} />
            </label>
            <label>
              Primary Email
              <input value={form.email} onChange={(event) => setForm((prev) => (prev ? { ...prev, email: event.target.value } : prev))} />
            </label>
          </div>

          <label>
            Address 1
            <input value={form.address1} onChange={(event) => setForm((prev) => (prev ? { ...prev, address1: event.target.value } : prev))} />
          </label>
          <label>
            Address 2
            <input value={form.address2} onChange={(event) => setForm((prev) => (prev ? { ...prev, address2: event.target.value } : prev))} />
          </label>
          <div className="row">
            <label>
              City
              <input value={form.city} onChange={(event) => setForm((prev) => (prev ? { ...prev, city: event.target.value } : prev))} />
            </label>
            <label>
              State
              <input value={form.state} onChange={(event) => setForm((prev) => (prev ? { ...prev, state: event.target.value } : prev))} />
            </label>
            <label>
              Zip
              <input value={form.zip} onChange={(event) => setForm((prev) => (prev ? { ...prev, zip: event.target.value } : prev))} />
            </label>
          </div>

          <h2>Phone Numbers</h2>
          {form.phones.map((phone, index) => (
            <div className="row" key={phone.id}>
              <input value={phone.label} onChange={(event) => updatePhone(index, { label: event.target.value })} placeholder="Label" />
              <input value={phone.number} onChange={(event) => updatePhone(index, { number: event.target.value })} placeholder="Phone" />
              <label>
                <input type="checkbox" checked={phone.primary} onChange={(event) => updatePhone(index, { primary: event.target.checked })} /> Primary
              </label>
              <button type="button" onClick={() => setForm((prev) => (prev ? { ...prev, phones: prev.phones.filter((_, nextIndex) => nextIndex !== index) } : prev))}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setForm((prev) => (prev ? { ...prev, phones: [...prev.phones, { id: rowId("phone"), label: "", number: "", primary: prev.phones.length === 0 }] } : prev))}>
            Add Phone
          </button>

          <h2>Email Addresses</h2>
          {form.emails.map((email, index) => (
            <div className="row" key={email.id}>
              <input value={email.label} onChange={(event) => updateEmail(index, { label: event.target.value })} placeholder="Label" />
              <input value={email.email} onChange={(event) => updateEmail(index, { email: event.target.value })} placeholder="Email" />
              <label>
                <input type="checkbox" checked={email.primary} onChange={(event) => updateEmail(index, { primary: event.target.checked })} /> Primary
              </label>
              <button type="button" onClick={() => setForm((prev) => (prev ? { ...prev, emails: prev.emails.filter((_, nextIndex) => nextIndex !== index) } : prev))}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setForm((prev) => (prev ? { ...prev, emails: [...prev.emails, { id: rowId("email"), label: "", email: "", primary: prev.emails.length === 0 }] } : prev))}>
            Add Email
          </button>

          <h2>Spouse Information</h2>
          <div className="row">
            <label>
              First Name
              <input value={form.spouse.firstName} onChange={(event) => setForm((prev) => (prev ? { ...prev, spouse: { ...prev.spouse, firstName: event.target.value } } : prev))} />
            </label>
            <label>
              Last Name
              <input value={form.spouse.lastName} onChange={(event) => setForm((prev) => (prev ? { ...prev, spouse: { ...prev.spouse, lastName: event.target.value } } : prev))} />
            </label>
            <label>
              Phone
              <input value={form.spouse.phone} onChange={(event) => setForm((prev) => (prev ? { ...prev, spouse: { ...prev.spouse, phone: event.target.value } } : prev))} />
            </label>
            <label>
              Email
              <input value={form.spouse.email} onChange={(event) => setForm((prev) => (prev ? { ...prev, spouse: { ...prev.spouse, email: event.target.value } } : prev))} />
            </label>
          </div>
          <label>
            Spouse Notes
            <textarea value={form.spouse.notes} onChange={(event) => setForm((prev) => (prev ? { ...prev, spouse: { ...prev.spouse, notes: event.target.value } } : prev))} rows={3} />
          </label>

          <h2>Household Linking</h2>
          <div className="row">
            <label>
              Household ID
              <input value={form.household.householdId} onChange={(event) => setForm((prev) => (prev ? { ...prev, household: { ...prev.household, householdId: event.target.value } } : prev))} />
            </label>
            <label>
              Relationship
              <input value={form.household.relationship} onChange={(event) => setForm((prev) => (prev ? { ...prev, household: { ...prev.household, relationship: event.target.value } } : prev))} />
            </label>
          </div>
          <label>
            Linked Customer IDs (comma separated)
            <input
              value={linkedIdsText}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        household: {
                          ...prev.household,
                          linkedCustomerIds: event.target.value
                            .split(",")
                            .map((id) => id.trim())
                            .filter(Boolean),
                        },
                      }
                    : prev,
                )
              }
            />
          </label>

          <h2>Garage</h2>
          {form.garage.map((vehicle, index) => (
            <div className="row" key={vehicle.id}>
              <input value={vehicle.year} onChange={(event) => updateGarage(index, { year: event.target.value })} placeholder="Year" />
              <input value={vehicle.make} onChange={(event) => updateGarage(index, { make: event.target.value })} placeholder="Make" />
              <input value={vehicle.model} onChange={(event) => updateGarage(index, { model: event.target.value })} placeholder="Model" />
              <input value={vehicle.vin} onChange={(event) => updateGarage(index, { vin: event.target.value })} placeholder="VIN" />
              <input value={vehicle.nickname} onChange={(event) => updateGarage(index, { nickname: event.target.value })} placeholder="Nickname" />
              <button type="button" onClick={() => setForm((prev) => (prev ? { ...prev, garage: prev.garage.filter((_, nextIndex) => nextIndex !== index) } : prev))}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setForm((prev) => (prev ? { ...prev, garage: [...prev.garage, { id: rowId("garage"), year: "", make: "", model: "", vin: "", nickname: "" }] } : prev))}>
            Add Vehicle
          </button>

          <h2>Tasks & Reminders</h2>
          <div className="stack">
            <label>
              Task Title
              <input value={taskDraft.title} onChange={(event) => setTaskDraft((prev) => ({ ...prev, title: event.target.value }))} />
            </label>
            <div className="row">
              <label>
                Due
                <input type="datetime-local" value={toDateTimeLocalInput(taskDraft.dueAt)} onChange={(event) => setTaskDraft((prev) => ({ ...prev, dueAt: dateTimeLocalToIso(event.target.value) }))} />
              </label>
              <label>
                Owner
                <input value={taskDraft.owner} onChange={(event) => setTaskDraft((prev) => ({ ...prev, owner: event.target.value }))} />
              </label>
              <label>
                Status
                <select value={taskDraft.status} onChange={(event) => setTaskDraft((prev) => ({ ...prev, status: event.target.value as CustomerTask["status"] }))}>
                  <option value="open">Open</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
            <label>
              Task Notes
              <textarea value={taskDraft.notes} onChange={(event) => setTaskDraft((prev) => ({ ...prev, notes: event.target.value }))} rows={2} />
            </label>
            <button type="button" onClick={addTask}>Add Task</button>
          </div>
          {form.tasks.length > 0 ? (
            <ul>
              {form.tasks.map((task) => (
                <li key={task.id}>
                  <strong>{task.title}</strong> ({task.status}) {task.dueAt ? `- due ${new Date(task.dueAt).toLocaleString()}` : ""}
                  <button type="button" onClick={() => setForm((prev) => (prev ? { ...prev, tasks: prev.tasks.filter((x) => x.id !== task.id) } : prev))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No tasks yet.</p>
          )}

          <h2>Attachments</h2>
          <div className="row">
            <input type="file" onChange={(event) => void onUploadAttachment(event.target.files)} />
            <button type="button" disabled={uploading}>{uploading ? "Uploading..." : "Upload"}</button>
          </div>
          {form.attachments.length > 0 ? (
            <ul>
              {form.attachments.map((attachment) => (
                <li key={attachment.attachmentId}>
                  <a href={`/api/v1/docs/attachments/${encodeURIComponent(attachment.attachmentId)}/download`} target="_blank" rel="noreferrer">{attachment.filename}</a>
                  {` (${Math.round(attachment.size / 1024)} KB)`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No attachments.</p>
          )}

          <h2>Notes</h2>
          <div className="row">
            <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={3} placeholder="Add customer note" />
            <button type="button" onClick={addNote}>Add Note</button>
          </div>
          {form.notes.length > 0 ? (
            <ul>
              {form.notes.map((note) => (
                <li key={note.id}>
                  {new Date(note.createdAt).toLocaleString()} - {note.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No notes yet.</p>
          )}

          <h2>Communication Log</h2>
          <div className="stack">
            <div className="row">
              <label>
                Channel
                <select value={commDraft.channel} onChange={(event) => setCommDraft((prev) => ({ ...prev, channel: event.target.value as CommunicationEntry["channel"] }))}>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="in_person">In Person</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Direction
                <select value={commDraft.direction} onChange={(event) => setCommDraft((prev) => ({ ...prev, direction: event.target.value as CommunicationEntry["direction"] }))}>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
              </label>
              <label>
                Date/Time
                <input type="datetime-local" value={toDateTimeLocalInput(commDraft.happenedAt)} onChange={(event) => setCommDraft((prev) => ({ ...prev, happenedAt: dateTimeLocalToIso(event.target.value) }))} />
              </label>
            </div>
            <label>
              Subject
              <input value={commDraft.subject} onChange={(event) => setCommDraft((prev) => ({ ...prev, subject: event.target.value }))} />
            </label>
            <label>
              Summary
              <textarea value={commDraft.summary} onChange={(event) => setCommDraft((prev) => ({ ...prev, summary: event.target.value }))} rows={3} />
            </label>
            <button type="button" onClick={addCommunication}>Add Communication Entry</button>
          </div>

          {form.communications.length > 0 ? (
            <ul>
              {form.communications.map((entry) => (
                <li key={entry.id}>
                  {new Date(entry.happenedAt).toLocaleString()} - {entry.direction} {entry.channel}
                  {entry.subject ? ` - ${entry.subject}` : ""}
                  {entry.summary ? ` - ${entry.summary}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No communication entries.</p>
          )}

          <div className="row">
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Customer CRM"}</button>
            <Link to={`/dms/customers/${itemId}`}>Back to Profile</Link>
          </div>
          {saveNotice ? <p className="muted">{saveNotice}</p> : null}
        </form>
      ) : null}
      {query.error ? <ErrorPanel error={query.error} title="Customer unavailable" /> : null}
      {saveError ? <ErrorPanel error={saveError} title="Save failed" /> : null}
    </div>
  );
}
