import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ModalHost } from "@kutm/ui-platform";
import { ModalProvider } from "@kutm/ui-platform";
import { openModal } from "@kutm/ui-platform";
function Harness() {
    return (_jsxs(ModalProvider, { children: [_jsx("button", { onClick: async () => {
                    const result = await openModal("customer.picker", { initialQuery: "Alex" });
                    const el = document.getElementById("result");
                    if (el) {
                        el.textContent = result?.customerId ?? "none";
                    }
                }, children: "Open" }), _jsx("div", { id: "result" }), _jsx(ModalHost, {})] }));
}
describe("customer picker integration", () => {
    it("resolves promise when close(result) is called", async () => {
        const user = userEvent.setup();
        render(_jsx(Harness, {}));
        await user.click(screen.getByRole("button", { name: "Open" }));
        await user.click(screen.getByTestId("picker-choose-c1"));
        expect(screen.getByText("c1")).toBeInTheDocument();
    });
});
