import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { createCustomerProfile, createDmsCustomerId, emptyCustomerInput } from "../api";

export function CustomerNewPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => emptyCustomerInput());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createCustomerProfile(form);
      navigate(`/dms/customers/${created.id}/edit`);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h1>New Customer</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="stack">
        <label>
          First Name
          <input value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} required />
        </label>
        <label>
          Last Name
          <input value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} required />
        </label>
        <label>
          DMS Customer ID
          <div className="row">
            <input
              value={form.dmsCustomerId}
              onChange={(event) => setForm((prev) => ({ ...prev, dmsCustomerId: event.target.value }))}
              placeholder="CUST-..."
            />
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  dmsCustomerId: createDmsCustomerId(prev.lastName),
                }))
              }
            >
              Generate
            </button>
          </div>
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
        </label>
        <label>
          Email
          <input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
        </label>
        <label>
          Address 1
          <input value={form.address1} onChange={(event) => setForm((prev) => ({ ...prev, address1: event.target.value }))} />
        </label>
        <label>
          Address 2
          <input value={form.address2} onChange={(event) => setForm((prev) => ({ ...prev, address2: event.target.value }))} />
        </label>
        <div className="row">
          <label>
            City
            <input value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} />
          </label>
          <label>
            State
            <input value={form.state} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} />
          </label>
          <label>
            Zip
            <input value={form.zip} onChange={(event) => setForm((prev) => ({ ...prev, zip: event.target.value }))} />
          </label>
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create Customer"}
        </button>
      </form>
      {error ? <ErrorPanel error={error} title="Create failed" /> : null}
    </div>
  );
}
