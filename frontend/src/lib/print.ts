import type { PluginContext } from "../plugins/context";
import type { PrintableDoc } from "../plugins/types";

type PrintTemplate = {
  id: string;
  label: string;
  canPrint: (ctx: PluginContext) => boolean;
  render: (data: unknown, ctx: PluginContext) => PrintableDoc;
};

const PRINT_PAYLOAD_KEY = "kutm-shell:print-preview";
const templates = new Map<string, PrintTemplate>();

export function registerPrintTemplates(nextTemplates: PrintTemplate[]): void {
  for (const template of nextTemplates) {
    templates.set(template.id, template);
  }
}

export function getPrintTemplates(): Array<{ id: string; label: string }> {
  return [...templates.values()].map((template) => ({ id: template.id, label: template.label }));
}

export function renderPrintable(templateId: string, data: unknown, ctx: PluginContext): PrintableDoc {
  const template = templates.get(templateId);
  if (!template) {
    throw new Error(`Unknown print template: ${templateId}`);
  }
  if (!template.canPrint(ctx)) {
    throw new Error(`Template ${templateId} is not available for current context`);
  }
  return template.render(data, ctx);
}

export function setPrintPreviewPayload(templateId: string, data: unknown): void {
  if (typeof window === "undefined") return;
  const payload = {
    templateId,
    data,
    at: new Date().toISOString(),
  };
  sessionStorage.setItem(PRINT_PAYLOAD_KEY, JSON.stringify(payload));
}

export function getPrintPreviewPayload(templateId: string): unknown {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PRINT_PAYLOAD_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { templateId: string; data: unknown };
    if (parsed.templateId !== templateId) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function openPrintPreview(templateId: string, data: unknown): void {
  if (typeof window === "undefined") return;
  setPrintPreviewPayload(templateId, data);
  window.open(`/print/${encodeURIComponent(templateId)}`, "_blank", "noopener,noreferrer");
}
