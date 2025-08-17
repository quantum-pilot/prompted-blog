// @agent: cloudflare-backend
import { describe, it, expect } from "vitest";
import { getSecurityHeaders, applySecurityHeaders } from "../security-headers";

describe("Security Headers", () => {
  describe("getSecurityHeaders", () => {
    it("should return all required security headers", () => {
      const headers = getSecurityHeaders();

      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
      expect(headers["Referrer-Policy"]).toBe(
        "strict-origin-when-cross-origin"
      );
      expect(headers["Content-Security-Policy"]).toBe(
        "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
      );
      expect(headers["Strict-Transport-Security"]).toBe(
        "max-age=31536000; includeSubDomains"
      );
      expect(headers["Permissions-Policy"]).toBe(
        "geolocation=(), microphone=(), camera=()"
      );
    });
  });

  describe("applySecurityHeaders", () => {
    it("should add security headers to response while preserving existing headers", () => {
      const originalResponse = new Response("test body", {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json",
          "Custom-Header": "custom-value",
        },
      });

      const securedResponse = applySecurityHeaders(originalResponse);

      // Check that original headers are preserved
      expect(securedResponse.headers.get("Content-Type")).toBe(
        "application/json"
      );
      expect(securedResponse.headers.get("Custom-Header")).toBe("custom-value");

      // Check that security headers are added
      expect(securedResponse.headers.get("X-Frame-Options")).toBe("DENY");
      expect(securedResponse.headers.get("X-Content-Type-Options")).toBe(
        "nosniff"
      );
      expect(securedResponse.headers.get("X-XSS-Protection")).toBe(
        "1; mode=block"
      );
      expect(securedResponse.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin"
      );
      expect(securedResponse.headers.get("Content-Security-Policy")).toBe(
        "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
      );
      expect(securedResponse.headers.get("Strict-Transport-Security")).toBe(
        "max-age=31536000; includeSubDomains"
      );
      expect(securedResponse.headers.get("Permissions-Policy")).toBe(
        "geolocation=(), microphone=(), camera=()"
      );

      // Check that status and body are preserved
      expect(securedResponse.status).toBe(200);
      expect(securedResponse.statusText).toBe("OK");
    });

    it("should override existing security headers if present", () => {
      const originalResponse = new Response("test body", {
        status: 200,
        headers: {
          "X-Frame-Options": "SAMEORIGIN",
          "Content-Type": "text/html",
        },
      });

      const securedResponse = applySecurityHeaders(originalResponse);

      // Check that security header is overridden
      expect(securedResponse.headers.get("X-Frame-Options")).toBe("DENY");
      // Check that non-security header is preserved
      expect(securedResponse.headers.get("Content-Type")).toBe("text/html");
    });
  });
});
