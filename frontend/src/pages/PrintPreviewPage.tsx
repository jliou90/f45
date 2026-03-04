import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { usePluginContext } from "../plugins/context";
import { getPrintPreviewPayload, renderPrintable } from "../lib/print";
import { Button, Card } from "../ui";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Record<string, unknown>;
}

type PrintPreviewPageProps = {
  templateIdOverride?: string;
};

export function PrintPreviewPage({ templateIdOverride }: PrintPreviewPageProps) {
  const params = useParams<{ templateId?: string; id?: string }>();
  const pluginContext = usePluginContext();
  const templateId = templateIdOverride ?? params.templateId ?? "";

  const printable = useMemo(() => {
    const payload = getPrintPreviewPayload(templateId) ?? {
      customerName: "Sample Customer",
      vehicle: "2025 Demo VIN",
      status: "Draft",
      request_id: "req-sample",
    };
    try {
      return renderPrintable(templateId, payload, pluginContext);
    } catch {
      const fallback = asRecord(payload);
      return {
        title: `Template not found: ${templateId}`,
        requestId: typeof fallback.request_id === "string" ? fallback.request_id : null,
        sections: Object.entries(fallback).map(([key, value]) => ({
          label: key,
          value: typeof value === "string" ? value : JSON.stringify(value),
        })),
      };
    }
  }, [templateId, pluginContext]);

  return (
    <div className="stack printPreview">
      <Card className="print-hidden">
        <h1>Print Preview</h1>
        <p className="muted">Template: {templateId}</p>
        <Button type="button" onClick={() => window.print()}>
          Print
        </Button>
      </Card>

      <Card className="printableDoc">
        <header className="printHeader">
          {pluginContext.branding.logoUrl ? (
            <img src={pluginContext.branding.logoUrl} alt={`${pluginContext.branding.brandName} logo`} className="sidebarLogo" />
          ) : null}
          <div>
            <h2>{pluginContext.branding.brandName}</h2>
            <h3>{printable.title}</h3>
          </div>
        </header>

        <table className="dataTable">
          <tbody>
            {printable.sections.map((section) => (
              <tr key={section.label}>
                <th>{section.label}</th>
                <td>{section.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="muted printFooter">request_id: {printable.requestId ?? "(none)"}</footer>
      </Card>
    </div>
  );
}
