import { z } from "zod";
export declare const meSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>;
    tenants: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>, "many">;
    defaultApps: z.ZodArray<z.ZodString, "many">;
    permissions: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        name: string;
    };
    tenants: {
        id: string;
        name: string;
    }[];
    defaultApps: string[];
    permissions: string[];
}, {
    user: {
        id: string;
        name: string;
    };
    tenants: {
        id: string;
        name: string;
    }[];
    defaultApps: string[];
    permissions: string[];
}>;
