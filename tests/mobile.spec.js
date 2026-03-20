import { test, expect } from "@playwright/test";

// Only run these tests on the iPhone 15 Pro project
test.describe("iPhone 15 Pro - Mobile UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("no horizontal overflow (no sideways scroll)", async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("start button fits within viewport width", async ({ page }) => {
    const btn = page.getByTestId("start-session-btn");
    const box = await btn.boundingBox();
    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  });

  test("start button has adequate touch target size (>=44px)", async ({ page }) => {
    const btn = page.getByTestId("start-session-btn");
    const box = await btn.boundingBox();
    // Apple Human Interface Guidelines: minimum 44pt tap target
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test("start button is a large slab filling bottom of viewport", async ({ page }) => {
    const btn = page.getByTestId("start-session-btn");
    const box = await btn.boundingBox();
    const viewport = page.viewportSize();
    // Button should be nearly full width (minus padding)
    expect(box.width).toBeGreaterThan(viewport.width * 0.8);
    // Button should fill a large portion of the viewport height
    expect(box.height).toBeGreaterThan(viewport.height * 0.4);
    // Button should be in the bottom half of the viewport
    expect(box.y + box.height).toBeGreaterThan(viewport.height * 0.7);
  });

  test("page body uses dark background", async ({ page }) => {
    const bgColor = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor,
    );
    expect(bgColor).toBe("rgb(17, 17, 17)");
  });

  test("no old UI elements present", async ({ page }) => {
    await expect(page.locator("text=realtime console")).not.toBeVisible();
    await expect(page.locator("text=Awaiting events...")).not.toBeVisible();
    await expect(
      page.locator('input[placeholder="send a text message..."]'),
    ).not.toBeVisible();
  });

  test("text is readable (white/light on dark bg)", async ({ page }) => {
    const btn = page.getByTestId("start-session-btn");
    const color = await btn.evaluate((el) =>
      window.getComputedStyle(el).color,
    );
    // Should be light text (white = rgb(255, 255, 255))
    expect(color).toBe("rgb(255, 255, 255)");
  });

  test("top bar is hidden before session starts", async ({ page }) => {
    const topBar = page.locator("#top-bar");
    await expect(topBar).not.toBeVisible();
  });
});
