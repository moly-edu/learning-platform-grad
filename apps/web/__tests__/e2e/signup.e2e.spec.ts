import { expect, test } from "@playwright/test";

test("signup validates email and password before submitting", async ({ page }) => {
  await page.goto("/signup");

  await expect(page.getByText("Sign Up", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeVisible();

  await page.getByLabel("Email").fill("invalid-email");
  await page.getByLabel("Password").fill("123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page.getByText("Invalid email")).toBeVisible();
  await expect(
    page.getByText("Password must be at least 8 characters"),
  ).toBeVisible();
});
