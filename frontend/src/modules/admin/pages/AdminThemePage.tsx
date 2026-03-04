import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/api";
import { publishWindowSync } from "../../../lib/window-sync";
import { useTenant } from "../../../app/use-tenant";
import { useQuery } from "../../../lib/query";
import { Button, Input, Select } from "../../../ui";
import { adminGetTenantProfile, adminGetTenantTheme, adminSetTenantLogoUrl, adminUpdateTenantTheme } from "../api";

const palette = ["#0b5ed7", "#0f766e", "#b45309", "#1d4ed8", "#be123c", "#334155"];

export function AdminThemePage() {
  const tenant = useTenant();
  const [error, setError] = useState<ApiError | null>(null);
  const themeQuery = useQuery(() => adminGetTenantTheme(), { deps: [] });
  const profileQuery = useQuery(() => adminGetTenantProfile(), { deps: [] });
  const [form, setForm] = useState({
    accent_color: "#0b5ed7",
    logo_variant: "default",
    sidebar_style: "default",
    print_header_enabled: false,
    logo_url: "",
  });

  useEffect(() => {
    const data = themeQuery.data;
    if (!data) return;
    queueMicrotask(() => {
      setForm((prev) => ({
        ...prev,
        accent_color: data.accent_color,
        logo_variant: data.logo_variant,
        sidebar_style: data.sidebar_style,
        print_header_enabled: data.print_header_enabled,
      }));
    });
  }, [themeQuery.data]);

  useEffect(() => {
    const data = profileQuery.data;
    if (!data) return;
    queueMicrotask(() => {
      setForm((prev) => ({ ...prev, logo_url: data.logo_url ?? "" }));
    });
  }, [profileQuery.data]);

  const onSave = async () => {
    setError(null);
    try {
      await adminUpdateTenantTheme({
        accent_color: form.accent_color,
        logo_variant: form.logo_variant,
        sidebar_style: form.sidebar_style,
        print_header_enabled: form.print_header_enabled,
      });
      if (form.logo_url !== (profileQuery.data?.logo_url ?? "")) {
        await adminSetTenantLogoUrl(form.logo_url);
      }
      await themeQuery.refetch();
      await profileQuery.refetch();
      document.documentElement.style.setProperty("--brand-accent", form.accent_color);
      publishWindowSync({ type: "FEATURE_FLAGS_UPDATED", payload: { tenantId: tenant.tenantId } });
    } catch (err) {
      setError(err as ApiError);
    }
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Admin / Theme</div>
        <h1>Theme & Branding</h1>
      </div>

      {error ? <div className="panel"><p className="muted">{error.message} (request_id: {error.request_id ?? "n/a"})</p></div> : null}

      <div className="panel stack">
        <label>Logo URL<Input value={form.logo_url} onChange={(event) => setForm((prev) => ({ ...prev, logo_url: event.target.value }))} /></label>
        {form.logo_url ? <img src={form.logo_url} alt="Tenant logo preview" style={{ maxHeight: "72px", objectFit: "contain" }} /> : null}

        <label>
          Accent color
          <Select value={form.accent_color} onChange={(event) => setForm((prev) => ({ ...prev, accent_color: event.target.value }))}>
            {palette.map((color) => (
              <option key={color} value={color}>{color}</option>
            ))}
          </Select>
        </label>

        <label>Logo variant<Input value={form.logo_variant} onChange={(event) => setForm((prev) => ({ ...prev, logo_variant: event.target.value }))} /></label>
        <label>Sidebar style<Input value={form.sidebar_style} onChange={(event) => setForm((prev) => ({ ...prev, sidebar_style: event.target.value }))} /></label>
        <label className="row">
          <input type="checkbox" checked={form.print_header_enabled} onChange={(event) => setForm((prev) => ({ ...prev, print_header_enabled: event.target.checked }))} />
          Print header enabled
        </label>

        <Button type="button" onClick={() => void onSave()}>Save Theme</Button>
      </div>
    </div>
  );
}
