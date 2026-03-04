import { z } from "zod";
export const customerSchema = z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string(),
    email: z.string().email()
});
