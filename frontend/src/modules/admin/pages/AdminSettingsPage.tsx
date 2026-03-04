import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/api";
import { useQuery } from "../../../lib/query";
import { Button, Input } from "../../../ui";
import { adminGetTenantProfile, adminUpdateTenantProfile } from "../api";

export function AdminSettingsPage() {
  const [error, setError] = useState<ApiError | null>(null);
  const profileQuery = useQuery(() => adminGetTenantProfile(), { deps: [] });
  const [form, setForm] = useState({
    display_name: "",
    legal_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setForm({
      display_name: profileQuery.data.display_name ?? "",
      legal_name: profileQuery.data.legal_name ?? "",
      phone: profileQuery.data.phone ?? "",
      address_line1: profileQuery.data.address_line1 ?? "",
      address_line2: profileQuery.data.address_line2 ?? "",
      city: profileQuery.data.city ?? "",
      state: profileQuery.data.state ?? "",
      postal_code: profileQuery.data.postal_code ?? "",
    });
  }, [profileQuery.data]);

  const onSave = async () => {
    setError(null);
    try {
      await adminUpdateTenantProfile(form);
      await profileQuery.refetch();
    } catch (err) {
      setError(err as ApiError);
    }
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Admin / Settings</div>
        <h1>Tenant Settings</h1>
        <p className="muted">Used in printouts and customer-facing headers.</p>
      </div>

      {error ? <div className="panel"><p className="muted">{error.message} (request_id: {error.request_id ?? "n/a"})</p></div> : null}

      <div className="panel stack">
        <label>Display name<Input value={form.display_name} onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))} /></label>
        <label>Legal name<Input value={form.legal_name} onChange={(event) => setForm((prev) => ({ ...prev, legal_name: event.target.value }))} /></label>
        <label>Phone<Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} /></label>
        <label>Address line 1<Input value={form.address_line1} onChange={(event) => setForm((prev) => ({ ...prev, address_line1: event.target.value }))} /></label>
        <label>Address line 2<Input value={form.address_line2} onChange={(event) => setForm((prev) => ({ ...prev, address_line2: event.target.value }))} /></label>
        <label>City<Input value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} /></label>
        <label>State<Input value={form.state} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} /></label>
        <label>Postal code<Input value={form.postal_code} onChange={(event) => setForm((prev) => ({ ...prev, postal_code: event.target.value }))} /></label>
        <Button type="button" onClick={() => void onSave()}>Save Settings</Button>
      </div>
    </div>
  );
}
