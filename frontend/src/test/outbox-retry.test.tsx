import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutboxPage } from "../pages/OutboxPage";

const items = [
  {
    id: "1",
    createdAt: "2026-02-28T00:00:00Z",
    method: "POST",
    path: "/dms/appointments",
    body: { status: "NEW" },
    withTenant: true,
    idempotencyKey: "id-1",
    retryCount: 0,
  },
];

vi.mock("../lib/outbox", () => ({
  list: vi.fn(async () => items),
  redactSensitiveData: (value: unknown) => value,
  retry: vi.fn(async (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) items.splice(index, 1);
  }),
  retryAll: vi.fn(async () => undefined),
  del: vi.fn(async (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) items.splice(index, 1);
  }),
  clear: vi.fn(async () => undefined),
  subscribeOutbox: vi.fn(() => () => undefined),
}));

vi.mock("../lib/window-sync", () => ({
  subscribeWindowSync: vi.fn(() => () => undefined),
}));

describe("OutboxPage", () => {
  it("removes item after successful retry", async () => {
    render(<OutboxPage />);

    await screen.findByText("/dms/appointments");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByText("/dms/appointments")).not.toBeInTheDocument();
    });
  });
});
