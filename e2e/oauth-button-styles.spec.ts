// @agent: styles
import { test, expect } from "./fixtures/test-base";
import { waitForComponentReady } from "./utils/helpers";

test.describe("OAuth Button Visual Styles", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForComponentReady(page, "oauth-flow-start");
  });

  test("should have Google button with correct brand colors", async ({
    page,
  }) => {
    const googleButton = page.locator(".oauth-button--google");
    await expect(googleButton).toBeVisible();

    // Google brand blue background
    await expect(googleButton).toHaveCSS(
      "background-color",
      "rgb(66, 133, 244)"
    ); // #4285f4
    await expect(googleButton).toHaveCSS("color", "rgb(255, 255, 255)"); // white text

    // Button styling
    const border = await googleButton.evaluate(
      (el) => window.getComputedStyle(el).border
    );
    // Check that border is either none or 0px
    expect(border === "none" || border.startsWith("0px")).toBe(true);
    await expect(googleButton).toHaveCSS("border-radius", "4px");
    await expect(googleButton).toHaveCSS("cursor", "pointer");
  });

  test("should have proper button dimensions and padding", async ({ page }) => {
    const googleButton = page.locator(".oauth-button--google");
    const viewportSize = page.viewportSize();

    // Check responsive height
    if (viewportSize && viewportSize.width >= 1025) {
      await expect(googleButton).toHaveCSS("height", "48px");
      await expect(googleButton).toHaveCSS("padding", "0px 24px");
    } else if (viewportSize && viewportSize.width >= 769) {
      await expect(googleButton).toHaveCSS("height", "44px");
      await expect(googleButton).toHaveCSS("padding", "0px 20px");
    } else {
      await expect(googleButton).toHaveCSS("height", "40px");
      await expect(googleButton).toHaveCSS("padding", "0px 16px");
    }

    // Typography
    await expect(googleButton).toHaveCSS("font-weight", "500");
    await expect(googleButton).toHaveCSS(
      "font-family",
      /system-ui|Roboto|-apple-system/
    );
  });

  test("should have hover state with darker shade", async ({ page }) => {
    const googleButton = page.locator(".oauth-button--google");

    // Check that hover state is defined in CSS
    const hasHoverRule = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          for (const rule of rules) {
            if (
              rule.selectorText &&
              rule.selectorText.includes(".oauth-button--google:hover")
            ) {
              return (
                rule.style.backgroundColor === "rgb(51, 103, 214)" ||
                rule.style.backgroundColor === "#3367d6"
              );
            }
          }
        } catch (e) {
          // Skip cross-origin stylesheets
        }
      }
      return false;
    });

    expect(hasHoverRule).toBe(true);
  });

  test("should have active state with even darker shade", async ({ page }) => {
    const googleButton = page.locator(".oauth-button--google");

    // Check that active state is defined in CSS
    const hasActiveRule = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          for (const rule of rules) {
            if (
              rule.selectorText &&
              rule.selectorText.includes(".oauth-button--google:active")
            ) {
              return (
                rule.style.backgroundColor === "rgb(42, 86, 198)" ||
                rule.style.backgroundColor === "#2a56c6"
              );
            }
          }
        } catch (e) {
          // Skip cross-origin stylesheets
        }
      }
      return false;
    });

    expect(hasActiveRule).toBe(true);
  });
});
