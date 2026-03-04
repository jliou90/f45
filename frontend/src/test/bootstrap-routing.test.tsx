import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../app/App";

describe("bootstrap routing", () => {
  it("routes to /login when no tokens are present", async () => {
    localStorage.clear();

    render(
      <MemoryRouter initialEntries={["/ops"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
  });
});