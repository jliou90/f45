import { z } from "zod";
import { ConflictDialog } from "../components/ConflictDialog";
import { CustomerEditDrawer } from "../components/CustomerEditDrawer";
import { CustomerPickerModal } from "../components/CustomerPickerModal";
export const modalRegistry = {
    "customer.picker": {
        key: "customer.picker",
        kind: "modal",
        payloadSchema: z.object({ initialQuery: z.string().optional() }),
        Component: CustomerPickerModal
    },
    "customer.edit": {
        key: "customer.edit",
        kind: "drawer",
        payloadSchema: z.object({ customerId: z.string() }),
        Component: CustomerEditDrawer
    },
    "platform.conflict": {
        key: "platform.conflict",
        kind: "modal",
        payloadSchema: z.object({
            entityType: z.string(),
            entityId: z.string(),
            attemptedIfMatch: z.string().optional()
        }),
        Component: ConflictDialog
    }
};
