import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PrintPreviewPage } from "../pages/PrintPreviewPage";

vi.mock("../plugins/context", () => ({
  usePluginContext: () => ({
    branding: {
      brandName: "Acme Rooftop",
      primaryColor: "#112233",
      secondaryColor: "#334455",
      logoUrl: null,
    },
  }),
}));

vi.mock("../lib/print", () => ({
  getPrintPreviewPayload: () => ({ customerName: "Jane", request_id: "req-123" }),
  renderPrintable: () => ({
    title: "Quote",
    requestId: "req-123",
    sections: [{ label: "Customer", value: "Jane" }],
  }),
}));

describe("Print preview", () => {
  it("renders with branding", () => {
    render(
      <MemoryRouter initialEntries={["/print/quote"]}>
        <Routes>
          <Route path="/print/:templateId" element={<PrintPreviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Acme Rooftop")).toBeInTheDocument();
    expect(screen.getByText("Quote")).toBeInTheDocument();
    expect(screen.getByText(/request_id: req-123/i)).toBeInTheDocument();
  });
});
