import { jsx as _jsx } from "react/jsx-runtime";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModalHost } from "./ModalHost";
import { ModalProvider } from "./ModalProvider";
import { openModal } from "./openModal";
describe("modal payload validation", () => {
    it("throws for invalid payload", async () => {
        render(_jsx(ModalProvider, { children: _jsx(ModalHost, {}) }));
        await expect(openModal("customer.picker", {
            initialQuery: 123
        })).rejects.toThrow("Invalid payload");
    });
});
