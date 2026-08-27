import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 320, height: 720 },
  { name: "tablet", width: 760, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
];

for (const viewport of viewports) {
  for (const theme of ["light", "dark"]) {
    test(`${viewport.name} ${theme} cards`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/design/examples/index.html");
      await page.locator("body").evaluate((body, value) => { body.dataset.sarmgTheme = value; }, theme);
      await expect(page.locator(".fixture")).toHaveScreenshot(`${viewport.name}-${theme}-cards.png`);
    });
  }
}

test("login keyboard focus and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design/examples/login.html");
  await page.keyboard.press("Tab");
  await expect(page.locator("#user")).toBeFocused();
  await expect(page.locator("body")).toHaveScreenshot("login-focused.png");
});

test("forced colors retains controls", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/design/examples/login.html");
  await expect(page.locator(".sarmg-login__card")).toBeVisible();
  await expect(page.locator(".sarmg-card__action")).toBeVisible();
});

