import { test, expect } from "@playwright/test";

test.describe("OAuth Callback Page", () => {
  // Simple tests that verify the OAuth callback page renders correctly
  // These tests don't attempt cross-page messaging which can be problematic in E2E tests

  test("should show processing state with authorization code", async ({
    page,
  }) => {
    await page.goto("/oauth-callback?code=test-auth-code&state=test-state-123");

    // Initially shows processing
    await expect(page.locator("#processing")).toBeVisible();
    await expect(page.locator("#processing .message")).toContainText(
      "Processing OAuth response"
    );
  });

  test("should show processing state with OAuth error", async ({ page }) => {
    await page.goto(
      "/oauth-callback?error=access_denied&error_description=User%20denied%20access"
    );

    // Should still show processing (error handling is in parent window)
    await expect(page.locator("#processing")).toBeVisible();
  });

  test("should show processing state with implicit flow token", async ({
    page,
  }) => {
    await page.goto(
      "/oauth-callback?access_token=bearer-token-123&token_type=Bearer&expires_in=3600"
    );

    await expect(page.locator("#processing")).toBeVisible();
  });

  test("should show warning when opened directly without parent", async ({
    page,
  }) => {
    // Open callback page directly (no parent window)
    await page.goto("/oauth-callback?code=test-code");

    // Should eventually show no-parent warning since there's no opener
    await expect(page.locator("#no-parent")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("#no-parent .message")).toContainText(
      "OAuth callback received"
    );
    await expect(page.locator("#no-parent .info")).toContainText(
      "couldn't be sent to a parent window"
    );
  });

  test("should show error when no OAuth parameters present", async ({
    page,
  }) => {
    // Open callback without any OAuth parameters
    await page.goto("/oauth-callback");

    // Should show error state
    await expect(page.locator("#error")).toBeVisible();
    await expect(page.locator("#error-details")).toContainText(
      "No OAuth parameters found in URL"
    );
  });

  test("should handle hash-based OAuth parameters", async ({ page }) => {
    // Some OAuth providers return parameters in the hash fragment
    await page.goto("/oauth-callback#access_token=hash-token&state=hash-state");

    // Should process hash parameters
    await expect(page.locator("#processing")).toBeVisible();
  });

  test("should be responsive on mobile", async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    await page.goto("/oauth-callback?code=mobile-test");

    // Check that the card is visible and properly sized on mobile
    const card = page.locator(".card");
    await expect(card).toBeVisible();

    // Verify mobile-friendly width
    const box = await card.boundingBox();
    expect(box?.width).toBeLessThan(400);
  });
});
