import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../components/CommandPalette";

vi.mock("../app/use-auth", () => ({
  useAuth: () => ({
    logout: vi.fn(),
  }),
}));

vi.mock("../app/use-tenant", () => ({
  useTenant: () => ({
    currentRole: "ADMIN",
    clearTenant: vi.fn(),
  }),
}));

vi.mock("../app/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    flags: {
      commsEnabled: true,
      accountingBeta: true,
      realtimeEnabled: false,
      pdfExportEnabled: true,
    },
  }),
}));

vi.mock("../app/use-telemetry", () => ({
  useTelemetry: () => ({
    copyDebugBundle: vi.fn(async () => undefined),
    downloadSupportBundle: vi.fn(async () => undefined),
  }),
}));

describe("CommandPalette", () => {
  it("opens with Ctrl+K", () => {
    render(
      <MemoryRouter>
        <CommandPalette onToggleTheme={vi.fn()} currentThemeMode="light" />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });
});
