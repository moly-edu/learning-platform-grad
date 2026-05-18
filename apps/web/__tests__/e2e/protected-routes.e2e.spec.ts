import { expect, test } from "@playwright/test";

test("protected dashboard classes route redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard/classes");
  await expect(page).toHaveURL(/\/signin$/);
});

test("protected class detail route redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard/class/test-class");
  await expect(page).toHaveURL(/\/signin$/);
});

test("protected organization route redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard/organization/demo");
  await expect(page).toHaveURL(/\/signin$/);
});

