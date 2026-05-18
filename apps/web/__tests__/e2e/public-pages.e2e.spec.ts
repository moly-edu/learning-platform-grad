import { expect, test } from "@playwright/test";

test("landing page renders the main hero content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Build curricula.")).toBeVisible();
  await expect(page.getByText("Create assignments.")).toBeVisible();
});

test("landing page shows key sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Everything you need to teach and learn")).toBeVisible();
  await expect(page.getByText("From course design to classroom")).toBeVisible();
  await expect(page.getByText("One platform, three perspectives")).toBeVisible();
});

test("landing page Sign In nav link opens the sign-in page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign In" }).first().click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("landing page Get Started CTA opens the sign-up page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Get Started" }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel("Full name")).toBeVisible();
});

test("landing page footer contains project GitHub link", async ({ page }) => {
  await page.goto("/");
  const githubLink = page.getByRole("link", { name: "GitHub" });
  await expect(githubLink).toBeVisible();
  await expect(githubLink).toHaveAttribute("href", /github\.com\/TranTam31\/learning-platform/);
});

test("signin page provides navigation to sign-up", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("link", { name: "Sign Up" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("signup page provides navigation to sign-in", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("link", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/signin$/);
});

