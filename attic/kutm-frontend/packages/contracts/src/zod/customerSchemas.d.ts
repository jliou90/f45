import { z } from "zod";
export declare const customerSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    phone: z.ZodString;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    phone: string;
    email: string;
}, {
    id: string;
    name: string;
    phone: string;
    email: string;
}>;
