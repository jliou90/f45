import { z } from "zod";
export const lockAcquireSchema = z.object({
    ok: z.boolean(),
    by: z.string().optional()
});
