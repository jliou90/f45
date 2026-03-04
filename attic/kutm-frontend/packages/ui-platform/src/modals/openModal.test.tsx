import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModalHost } from "./ModalHost";
import { ModalProvider } from "./ModalProvider";
import { openModal } from "./openModal";

describe("modal payload validation", () => {
  it("throws for invalid payload", async () => {
    render(
      <ModalProvider>
        <ModalHost />
      </ModalProvider>
    );

    await expect(
      openModal("customer.picker", {
        initialQuery: 123 as unknown as string
      })
    ).rejects.toThrow("Invalid payload");
  });
});
