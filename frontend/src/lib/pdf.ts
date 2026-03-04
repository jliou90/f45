import type { ResolvedBranding } from "./branding";

type PrintPayload = {
  title: string;
  requestId?: string | null;
  branding: ResolvedBranding;
  sections: Array<{ label: string; value: string }>;
};

function buildHtml(payload: PrintPayload): string {
  const rows = payload.sections
    .map(
      (section) =>
        `<tr><th>${section.label}</th><td>${section.value
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${payload.title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
      .header { border-bottom: 3px solid ${payload.branding.primaryColor}; padding-bottom: 12px; margin-bottom: 18px; }
      .brand { color: ${payload.branding.secondaryColor}; font-size: 20px; font-weight: 700; }
      .logo { max-height: 56px; max-width: 220px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #ddd; text-align: left; padding: 8px; vertical-align: top; }
      th { width: 200px; color: #333; }
      .footer { margin-top: 22px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
    </style>
  </head>
  <body>
    <header class="header">
      ${payload.branding.logoUrl ? `<img src="${payload.branding.logoUrl}" alt="logo" class="logo" />` : ""}
      <div class="brand">${payload.branding.brandName}</div>
      <h1>${payload.title}</h1>
    </header>
    <table>${rows}</table>
    <footer class="footer">request_id: ${payload.requestId ?? "(none)"}</footer>
  </body>
</html>`;
}

function printHtmlDocument(html: string): void {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!printWindow) {
    throw new Error("Unable to open print window");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function printRepairOrder(args: { branding: ResolvedBranding; requestId?: string | null; data: Record<string, unknown> }): void {
  const sections = Object.entries(args.data).map(([label, value]) => ({
    label,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
  printHtmlDocument(buildHtml({ title: "Repair Order", requestId: args.requestId, branding: args.branding, sections }));
}

export function printQuote(args: { branding: ResolvedBranding; requestId?: string | null; data: Record<string, unknown> }): void {
  const sections = Object.entries(args.data).map(([label, value]) => ({
    label,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
  printHtmlDocument(buildHtml({ title: "Quote", requestId: args.requestId, branding: args.branding, sections }));
}
