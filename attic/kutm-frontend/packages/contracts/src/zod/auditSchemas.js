import { z } from "zod";
export const auditSchema = z.object({
    events: z.array(z.object({
        ts: z.string(),
        actor: z.string(),
        action: z.string(),
        diff: z.unknown()
    }))
});
