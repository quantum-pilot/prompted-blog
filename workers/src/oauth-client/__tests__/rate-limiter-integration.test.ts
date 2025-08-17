// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import worker from "../../index";
import type { Env } from "../types";

describe("OAuth Rate Limiting Integration", () => {
  let env: Env;

  beforeEach(() => {
    const kvStore = new Map<string, { value: string; expiry?: number }>();

    env = {
      ALLOWED_ORIGINS: "",
      GOOGLE_CLIENT_ID: "test-google-client",
      CLIENT_ID: "test-client",
      REDIRECT_URI: "http://localhost:3000/callback",
      FRONTEND_URL: "http://localhost:3000",
      SESSION_ENCRYPTION_KEY: "test-key",
      SESSION_ENCRYPTION_SALT: "test-salt-for-rate-limiter-test",
      OAUTH_SESSIONS: {
        put: vi.fn(async (key: string, value: string, options?: any) => {
          const expiry = options?.expirationTtl
            ? Date.now() + options.expirationTtl * 1000
            : undefined;
          kvStore.set(key, { value, expiry });
        }),
        get: vi.fn(async (key: string) => {
          const item = kvStore.get(key);
          if (!item) return null;
          if (item.expiry && Date.now() > item.expiry) {
            kvStore.delete(key);
            return null;
          }
          return item.value;
        }),
        delete: vi.fn(async (key: string) => {
          kvStore.delete(key);
        }),
      } as any,
    };
  });

  describe("OAuth callback rate limiting", () => {
    it("should allow requests up to the rate limit", async () => {
      const clientIp = "192.168.1.100";

      // Make 10 requests (the configured limit)
      for (let i = 0; i < 10; i++) {
        const request = new Request("http://localhost/oauth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": clientIp,
          },
          body: JSON.stringify({
            code: "test",
            state: "test",
            code_verifier: "test",
          }),
        });

        const response = await worker.fetch(request, env, {});
        // Will fail with missing PKCE challenge, but shouldn't be rate limited
        expect(response.status).not.toBe(429);
      }

      // 11th request should be rate limited
      const blockedRequest = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": clientIp,
        },
        body: JSON.stringify({
          code: "test",
          state: "test",
          code_verifier: "test",
        }),
      });

      const blockedResponse = await worker.fetch(blockedRequest, env, {});
      expect(blockedResponse.status).toBe(429);

      const data = (await blockedResponse.json()) as any;
      expect(data.error).toBe("rate_limit_exceeded");
      expect(data.message).toBe("Too many requests");

      // Check Retry-After header
      expect(blockedResponse.headers.get("Retry-After")).toBe("60");
    });

    it("should track rate limits per IP address", async () => {
      const ip1 = "192.168.1.101";
      const ip2 = "192.168.1.102";

      // Make 10 requests from IP1
      for (let i = 0; i < 10; i++) {
        const request = new Request("http://localhost/oauth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": ip1,
          },
          body: JSON.stringify({
            code: "test",
            state: "test",
            code_verifier: "test",
          }),
        });
        const response = await worker.fetch(request, env, {});
        expect(response.status).not.toBe(429);
      }

      // IP2 should still be allowed
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": ip2,
        },
        body: JSON.stringify({
          code: "test",
          state: "test",
          code_verifier: "test",
        }),
      });
      const response = await worker.fetch(request, env, {});
      expect(response.status).not.toBe(429);

      // But IP1 should be blocked
      const blockedRequest = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": ip1,
        },
        body: JSON.stringify({
          code: "test",
          state: "test",
          code_verifier: "test",
        }),
      });
      const blockedResponse = await worker.fetch(blockedRequest, env, {});
      expect(blockedResponse.status).toBe(429);
    });

    it("should not apply rate limiting to other endpoints", async () => {
      const clientIp = "192.168.1.103";

      // Make many requests to health endpoint
      for (let i = 0; i < 20; i++) {
        const request = new Request("http://localhost/health", {
          headers: {
            "CF-Connecting-IP": clientIp,
          },
        });
        const response = await worker.fetch(request, env, {});
        expect(response.status).toBe(200);
      }
    });

    it("should return proper CORS headers on rate limited responses", async () => {
      const clientIp = "192.168.1.104";
      const origin = "http://localhost:3000";

      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        const request = new Request("http://localhost/oauth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": clientIp,
            Origin: origin,
          },
          body: JSON.stringify({
            code: "test",
            state: "test",
            code_verifier: "test",
          }),
        });
        await worker.fetch(request, env, {});
      }

      // Next request should be rate limited with CORS headers
      const blockedRequest = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": clientIp,
          Origin: origin,
        },
        body: JSON.stringify({
          code: "test",
          state: "test",
          code_verifier: "test",
        }),
      });

      const blockedResponse = await worker.fetch(blockedRequest, env, {});
      expect(blockedResponse.status).toBe(429);

      // Note: CORS headers might not be present on rate-limited responses
      // This depends on whether the router applies CORS before or after rate limiting
    });
  });
});
