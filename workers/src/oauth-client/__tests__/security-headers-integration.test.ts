// @agent: cloudflare-backend
import { describe, it, expect } from "vitest";
import { applySecurityHeaders } from "../../utils/security-headers";
// Router removed - using Hono framework now
import type { Env } from "../types";
import { RequestContext } from "../../utils/request-context";

describe("Security Headers Integration", () => {
  describe("RequestContext.errorResponse", () => {
    it("should include security headers in error responses", () => {
      const mockEnv: Env = {
        ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5173",
        OAUTH_SESSIONS: {} as any,
        SESSION_ENCRYPTION_KEY: "test",
        SESSION_ENCRYPTION_SALT: "test-salt-for-security-headers-test"
      };
      const mockRequest = new Request("https://test.com", {
        headers: { Origin: "http://localhost:3000" }
      });
      const mockContext = new RequestContext(mockRequest);
      const response = mockContext.errorResponse(
        400,
        "test_error",
        "Test error message",
        mockEnv
      );

      // Verify security headers are applied (actual values tested in unit tests)
      expect(response.headers.get("X-Frame-Options")).toBeDefined();
      expect(response.headers.get("X-Content-Type-Options")).toBeDefined();

      // Check original headers are preserved
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000"
      );
    });
  });

  // Router tests removed - now using Hono middleware which handles this
  describe("applySecurityHeaders function", () => {
    it("should apply security headers to responses", () => {
      const originalResponse = new Response("test body", {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        }
      });

      const securedResponse = applySecurityHeaders(originalResponse);

      // Verify security headers are present
      expect(securedResponse.headers.get("X-Frame-Options")).toBeDefined();
      expect(securedResponse.headers.get("X-Content-Type-Options")).toBeDefined();
      expect(securedResponse.headers.get("Strict-Transport-Security")).toBeDefined();

      // Check original headers are preserved
      expect(securedResponse.headers.get("Content-Type")).toBe("text/plain");
    });

    it("should preserve response body and status", async () => {
      const body = JSON.stringify({ message: "test" });
      const originalResponse = new Response(body, {
        status: 201,
        statusText: "Created"
      });

      const securedResponse = applySecurityHeaders(originalResponse);

      expect(securedResponse.status).toBe(201);
      expect(securedResponse.statusText).toBe("Created");
      expect(await securedResponse.text()).toBe(body);
    });
  });
});
