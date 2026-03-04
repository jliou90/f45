import { z } from "zod";
export declare const lockAcquireSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    by?: string | undefined;
}, {
    ok: boolean;
    by?: string | undefined;
}>;
