import { test, expect } from "@playwright/test";

test("signin validates email and password before submitting", async ({ page }) => {
  await page.goto("/signin");

  await expect(page.getByText("Sign In")).toBeVisible();

  await page.getByLabel("Email").fill("invalid-email");
  await page.getByLabel("Password").fill("123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Invalid email")).toBeVisible();
  await expect(
    page.getByText("Password must be at least 8 characters"),
  ).toBeVisible();
});
