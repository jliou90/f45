import { z } from "zod";

export const meSchema = z.object({
  user: z.object({ id: z.string(), name: z.string() }),
  tenants: z.array(z.object({ id: z.string(), name: z.string() })),
  defaultApps: z.array(z.string()),
  permissions: z.array(z.string())
});
