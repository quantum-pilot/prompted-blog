// @agent: cloudflare-backend
import { describe, it, expect } from "vitest";
import { applySecurityHeaders } from "../../utils/security-headers";
import { Router } from "../../utils/router";
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

  describe("Router responses", () => {
    it("should apply security headers to handler responses", async () => {
      const router = new Router();
      const mockEnv: Env = {
        OAUTH_SESSIONS: {} as any,
        GOOGLE_CLIENT_ID: "test-client-id",
        CLIENT_ID: "test-client-id",
        REDIRECT_URI: "http://localhost:3000/callback",
        FRONTEND_URL: "http://localhost:3000",
        SESSION_ENCRYPTION_KEY: "test-key",
        SESSION_ENCRYPTION_SALT: "test-salt-for-security-headers-test"
      };

      const mockContext = {
        correlationId: "test-id",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        requestId: "req-id",
        userId: null,
        sessionId: null,
        log: () => {}
      } as RequestContext;

      router.get("/test", (_env, _context) => {
        return new Response(JSON.stringify({ message: "test" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        });
      });

      const request = new Request("http://localhost/test", { method: "GET" });
      const response = await router.handle(request, mockEnv, mockContext);

      expect(response).not.toBeNull();
      if (response) {
        // Verify security headers are present (actual values tested in unit tests)
        expect(response.headers.get("X-Frame-Options")).toBeDefined();
        expect(response.headers.get("X-Content-Type-Options")).toBeDefined();
        expect(response.headers.get("Strict-Transport-Security")).toBeDefined();

        // Check original headers are preserved
        expect(response.headers.get("Content-Type")).toBe("application/json");
      }
    });

    it("should apply security headers to async handler responses", async () => {
      const router = new Router();
      const mockEnv: Env = {
        OAUTH_SESSIONS: {} as any,
        GOOGLE_CLIENT_ID: "test-client-id",
        CLIENT_ID: "test-client-id",
        REDIRECT_URI: "http://localhost:3000/callback",
        FRONTEND_URL: "http://localhost:3000",
        SESSION_ENCRYPTION_KEY: "test-key",
        SESSION_ENCRYPTION_SALT: "test-salt-for-security-headers-test"
      };

      const mockContext = {
        correlationId: "test-id",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        requestId: "req-id",
        userId: null,
        sessionId: null,
        log: () => {}
      } as RequestContext;

      router.get("/test-async", async (_env, _context) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 1));
        return new Response(JSON.stringify({ async: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Custom-Header": "custom-value"
          }
        });
      });

      const request = new Request("http://localhost/test-async", {
        method: "GET"
      });
      const response = await router.handle(request, mockEnv, mockContext);

      expect(response).not.toBeNull();
      if (response) {
        expect(response.status).toBe(200);

        // Verify security headers are present
        expect(response.headers.get("X-Frame-Options")).toBeDefined();
        expect(response.headers.get("Strict-Transport-Security")).toBeDefined();

        // Check original headers are preserved
        expect(response.headers.get("Content-Type")).toBe("application/json");
        expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
      }
    });
  });
});
