import { apiClient } from "../api/apiClient";
export const noopLockManager = {
    async acquire() {
        return { ok: true };
    },
    async release() {
        return;
    }
};
export const apiLockManager = {
    async acquire(req) {
        const resp = await apiClient.request({
            method: "POST",
            path: "/locks/acquire",
            body: req
        });
        if (resp.data.ok) {
            return { ok: true };
        }
        return { ok: false, reason: "busy", by: resp.data.by };
    },
    async release(req) {
        await apiClient.request({ method: "POST", path: "/locks/release", body: req });
    }
};
