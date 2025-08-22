// @agent: styles
import { test, expect } from "@playwright/test";

test.describe("App-level responsive styles", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should be responsive on mobile viewports", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const containerStyles = await page.evaluate(() => {
      const container = document.querySelector(".app-container");
      if (!container) throw new Error("App container not found");
      const computedStyles = getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      return {
        width: computedStyles.width,
        actualWidth: rect.width,
        padding: computedStyles.padding,
        viewportWidth: window.innerWidth,
        boxSizing: computedStyles.boxSizing,
      };
    });

    expect(containerStyles.actualWidth).toBe(375);
    expect(containerStyles.padding).toBe("32px");
    expect(containerStyles.boxSizing).toBe("border-box");
  });

  test("should be responsive on tablet viewports", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const containerStyles = await page.evaluate(() => {
      const container = document.querySelector(".app-container");
      if (!container) throw new Error("App container not found");
      const computedStyles = getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      return {
        width: computedStyles.width,
        widthValue: parseInt(computedStyles.width),
        maxWidth: computedStyles.maxWidth,
        actualWidth: rect.width,
        boxSizing: computedStyles.boxSizing,
      };
    });

    expect(containerStyles.maxWidth).toBe("800px");
    expect(containerStyles.actualWidth).toBe(768);
  });

  test("should be responsive on desktop viewports", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    const containerStyles = await page.evaluate(() => {
      const container = document.querySelector(".app-container");
      if (!container) throw new Error("App container not found");
      const computedStyles = getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      return {
        width: computedStyles.width,
        widthValue: parseInt(computedStyles.width),
        maxWidth: computedStyles.maxWidth,
        actualWidth: Math.round(rect.width),
        boxSizing: computedStyles.boxSizing,
      };
    });

    expect(containerStyles.maxWidth).toBe("800px");
    if (containerStyles.boxSizing === "border-box") {
      expect(containerStyles.actualWidth).toBeGreaterThanOrEqual(799);
      expect(containerStyles.actualWidth).toBeLessThanOrEqual(801);
    } else {
      expect(containerStyles.actualWidth).toBe(864);
    }
  });
});
