import { z } from "zod";
export declare const auditSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        ts: z.ZodString;
        actor: z.ZodString;
        action: z.ZodString;
        diff: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        ts: string;
        actor: string;
        action: string;
        diff?: unknown;
    }, {
        ts: string;
        actor: string;
        action: string;
        diff?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    events: {
        ts: string;
        actor: string;
        action: string;
        diff?: unknown;
    }[];
}, {
    events: {
        ts: string;
        actor: string;
        action: string;
        diff?: unknown;
    }[];
}>;
