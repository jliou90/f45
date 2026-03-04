import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../app/use-tenant", () => ({
  useTenant: () => ({
    currentRole: "ADMIN",
    tenantId: "tenant-1",
  }),
}));

vi.mock("../app/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    flags: {
      commsEnabled: false,
      accountingBeta: true,
      realtimeEnabled: false,
      pdfExportEnabled: true,
    },
  }),
}));

vi.mock("../lib/branding", () => ({
  getTenantBranding: () => ({
    brandName: "KUTM",
    primaryColor: "#0b5ed7",
    secondaryColor: "#213d57",
    logoUrl: null,
  }),
}));

import { Sidebar } from "../components/Sidebar";

describe("Feature flags module visibility", () => {
  it("hides comms module when commsEnabled is false", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Comms")).not.toBeInTheDocument();
    expect(screen.getByText("Accounting")).toBeInTheDocument();
  });
});
