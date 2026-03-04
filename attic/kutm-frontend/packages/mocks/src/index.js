import { worker } from "./msw/browser";
export async function initializeMocking() {
    if (typeof window === "undefined") {
        return;
    }
    await worker.start({ onUnhandledRequest: "bypass" });
}
export * from "./msw/handlers";
export * from "./data/fixtures";
