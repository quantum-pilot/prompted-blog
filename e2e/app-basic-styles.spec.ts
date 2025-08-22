// @agent: styles
import { test, expect } from "@playwright/test";

test.describe("App-level basic styles", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should apply CSS variables correctly", async ({ page }) => {
    const rootStyles = await page.evaluate(() => {
      const root = document.documentElement;
      const computedStyles = getComputedStyle(root);
      return {
        buttonBg: computedStyles.getPropertyValue("--button-bg").trim(),
        buttonBgHover: computedStyles
          .getPropertyValue("--button-bg-hover")
          .trim(),
        buttonBorder: computedStyles.getPropertyValue("--button-border").trim(),
        textPrimary: computedStyles.getPropertyValue("--text-primary").trim(),
        borderColor: computedStyles.getPropertyValue("--border-color").trim(),
        shadowSmall: computedStyles.getPropertyValue("--shadow-small").trim(),
        focusOutline: computedStyles.getPropertyValue("--focus-outline").trim(),
      };
    });

    expect(rootStyles.buttonBg).toBe("#ffffff");
    expect(rootStyles.buttonBgHover).toBe("#f5f5f5");
    expect(rootStyles.buttonBorder).toBe("#d1d5db");
    expect(rootStyles.textPrimary).toBe("#111827");
    expect(rootStyles.borderColor).toBe("#9ca3af");
    expect(rootStyles.shadowSmall).toBe("rgba(0, 0, 0, 0.1)");
    expect(rootStyles.focusOutline).toBe("#2563eb");
  });

  test("should apply body styles correctly", async ({ page }) => {
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const computedStyles = getComputedStyle(body);
      const viewportHeight = window.innerHeight;
      return {
        margin: computedStyles.margin,
        padding: computedStyles.padding,
        fontFamily: computedStyles.fontFamily,
        background: computedStyles.backgroundColor,
        minHeight: computedStyles.minHeight,
        minHeightValue: parseInt(computedStyles.minHeight),
        viewportHeight: viewportHeight,
        display: computedStyles.display,
        alignItems: computedStyles.alignItems,
        justifyContent: computedStyles.justifyContent,
      };
    });

    expect(bodyStyles.margin).toBe("0px");
    expect(bodyStyles.padding).toBe("0px");
    expect(bodyStyles.fontFamily).toContain("-apple-system");
    expect(bodyStyles.background).toBe("rgb(249, 250, 251)"); // #f9fafb in RGB

    expect(bodyStyles.minHeightValue).toBe(bodyStyles.viewportHeight);
    expect(bodyStyles.display).toBe("flex");
    expect(bodyStyles.alignItems).toBe("center");
    expect(bodyStyles.justifyContent).toBe("center");
  });

  test("should apply app-container styles correctly", async ({ page }) => {
    const containerStyles = await page.evaluate(() => {
      const container = document.querySelector(".app-container");
      if (!container) throw new Error("App container not found");
      const computedStyles = getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      return {
        width: computedStyles.width,
        actualWidth: rect.width,
        maxWidth: computedStyles.maxWidth,
        maxWidthValue: parseInt(computedStyles.maxWidth),
        padding: computedStyles.padding,
        boxSizing: computedStyles.boxSizing,
      };
    });

    // Container should have max-width of 800px
    expect(containerStyles.maxWidthValue).toBe(800);

    // or is just 800 when boxSizing is border-box
    if (containerStyles.boxSizing === "border-box") {
      expect(containerStyles.actualWidth).toBeLessThanOrEqual(800);
    } else {
      expect(containerStyles.actualWidth).toBeLessThanOrEqual(864);
    }
    expect(containerStyles.padding).toBe("32px"); // 2rem = 32px with default font size
  });

});
