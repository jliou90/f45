import type { ModulePlugin } from "../../plugins/types";
import { registerPrintTemplates } from "../../lib/print";
import { CommsRoutes } from "./routes";

export const commsPlugin: ModulePlugin = {
  id: "module.comms",
  name: "Comms",
  version: "1.0.0",
  description: "Quote approvals and conversation timelines.",
  keywords: ["dms", "comms", "approval", "quotes"],
  routeBase: "/dms/comms",
  nav: {
    section: "DMS",
    label: "Comms",
    order: 240,
  },
  routePolicy: "COMMS",
  featureFlag: "commsEnabled",
  init: (ctx) => {
    if (!commsPlugin.print) return;
    registerPrintTemplates(commsPlugin.print.templates);
    ctx.registerCommands();
  },
  routes: () => CommsRoutes(),
  launcherTiles: () => [
    {
      id: "dms-comms",
      name: "Comms",
      description: "Quote approvals and conversation timelines.",
      to: "/dms/comms",
      keywords: ["dms", "comms", "approval", "quotes"],
    },
  ],
  realtime: {
    topics: ["comms.updated"],
    onEvent: () => {
      // No-op for now; page-level handlers will consume updates.
    },
  },
  print: {
    templates: [
      {
        id: "quote",
        label: "Quote",
        canPrint: () => true,
        render: (data, ctx) => {
          const record = (data ?? {}) as Record<string, unknown>;
          return {
            title: `${ctx.branding.brandName} Quote`,
            requestId: typeof record.request_id === "string" ? record.request_id : null,
            sections: [
              { label: "Customer", value: String(record.customerName ?? "Unknown") },
              { label: "Vehicle", value: String(record.vehicle ?? "Unknown") },
              { label: "Status", value: String(record.status ?? "Unknown") },
              { label: "Updated", value: String(record.latestMessageAt ?? new Date().toISOString()) },
            ],
          };
        },
      },
      {
        id: "repair-order",
        label: "Repair Order",
        canPrint: () => true,
        render: (data, ctx) => {
          const record = (data ?? {}) as Record<string, unknown>;
          return {
            title: `${ctx.branding.brandName} Repair Order`,
            requestId: typeof record.request_id === "string" ? record.request_id : null,
            sections: [
              { label: "Customer", value: String(record.customerName ?? "Unknown") },
              { label: "Vehicle", value: String(record.vehicle ?? "Unknown") },
              { label: "Status", value: String(record.status ?? "Unknown") },
              { label: "Last Event", value: String(record.latestMessageAt ?? new Date().toISOString()) },
            ],
          };
        },
      },
    ],
  },
};

