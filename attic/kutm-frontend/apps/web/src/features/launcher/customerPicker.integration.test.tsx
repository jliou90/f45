import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ModalHost } from "@kutm/ui-platform";
import { ModalProvider } from "@kutm/ui-platform";
import { openModal } from "@kutm/ui-platform";

function Harness() {
  return (
    <ModalProvider>
      <button
        onClick={async () => {
          const result = await openModal("customer.picker", { initialQuery: "Alex" });
          const el = document.getElementById("result");
          if (el) {
            el.textContent = result?.customerId ?? "none";
          }
        }}
      >
        Open
      </button>
      <div id="result" />
      <ModalHost />
    </ModalProvider>
  );
}

describe("customer picker integration", () => {
  it("resolves promise when close(result) is called", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByTestId("picker-choose-c1"));

    expect(screen.getByText("c1")).toBeInTheDocument();
  });
});
