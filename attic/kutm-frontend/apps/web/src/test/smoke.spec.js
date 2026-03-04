import { test, expect } from "@playwright/test";
test("login launcher picker drawer conflict flow", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("login-button").click();
    await expect(page.getByTestId("launcher-user")).toHaveText("Demo User");
    await page.getByTestId("open-picker").click();
    await page.getByTestId("picker-choose-c1").click();
    await expect(page.getByRole("heading", { name: "Customer c1" })).toBeVisible();
    await page.getByTestId("page-open-edit").click();
    await page.getByTestId("customer-name-input").fill("Alex Customer Updated");
    await page.getByTestId("save-customer").click();
    await expect(page.getByTestId("conflict-dialog")).toBeVisible();
    await page.getByTestId("resolve-reload").click();
    await page.getByTestId("save-customer").click();
    await expect(page.getByTestId("save-status")).toHaveText("saved");
});
