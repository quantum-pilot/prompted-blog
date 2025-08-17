// @agent: cloudflare-backend
import { describe, it, expect, vi } from "vitest";
import { RateLimiter } from "../rate-limiter";
import { SessionManager } from "../../oauth-client/session-manager";
import { RequestContext } from "../request-context";
import type { Env } from "../../oauth-client/types";

describe("Performance Tests", () => {
  describe("Rate Limiter", () => {
    it("should check rate limit in less than 50ms", async () => {
      const mockKV = {
        get: vi.fn(async () => null),
        put: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
      };

      const rateLimiter = new RateLimiter({
        kv: mockKV,
        limit: 5,
        windowMs: 60000,
        keyPrefix: "test",
      });

      const start = performance.now();
      await rateLimiter.isAllowed("perf-test-ip");
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe("Session Manager Encryption", () => {
    it("should complete encryption/decryption within 50ms", async () => {
      const kvStore = new Map<string, string>();
      const mockEnv: Env = {
        GOOGLE_CLIENT_ID: "test",
        CLIENT_ID: "test",
        REDIRECT_URI: "http://localhost:3000/callback",
        FRONTEND_URL: "http://localhost:3000",
        SESSION_ENCRYPTION_KEY:
          "test-encryption-key-must-be-32-bytes-long-exactly!",
        SESSION_ENCRYPTION_SALT: "test-salt-for-performance-tests",
        OAUTH_SESSIONS: {
          put: async (key: string, value: string) => {
            kvStore.set(key, value);
          },
          get: async (key: string) => kvStore.get(key) || null,
          delete: async (key: string) => {
            kvStore.delete(key);
          },
        } as any,
        OAUTH_KV: {} as any,
      };

      const sessionManager = new SessionManager(mockEnv);
      const mockRequest = new Request("http://localhost/test");
      const context = await RequestContext.create(mockRequest, mockEnv);
      context.userId = "perf-test";

      const sessionData = {
        provider: "google" as const,
        userId: "perf-test",
        email: "perf@test.com",
        name: "Performance Test User",
        picture: "https://example.com/large-url-path.jpg",
        expiresAt: Date.now() + 3600000,
      };

      const startTime = Date.now();
      const sessionId = await sessionManager.createSession(
        sessionData,
        context
      );
      const retrieved = await sessionManager.getSession(sessionId, context);
      const duration = Date.now() - startTime;

      expect(retrieved).toBeDefined();
      expect(duration).toBeLessThan(50);
    });

    it("should handle large session data efficiently", async () => {
      const kvStore = new Map<string, string>();
      const mockEnv: Env = {
        GOOGLE_CLIENT_ID: "test",
        CLIENT_ID: "test",
        REDIRECT_URI: "http://localhost:3000/callback",
        FRONTEND_URL: "http://localhost:3000",
        SESSION_ENCRYPTION_KEY:
          "test-encryption-key-must-be-32-bytes-long-exactly!",
        SESSION_ENCRYPTION_SALT: "test-salt-for-performance-tests",
        OAUTH_SESSIONS: {
          put: async (key: string, value: string) => {
            kvStore.set(key, value);
          },
          get: async (key: string) => kvStore.get(key) || null,
          delete: async (key: string) => {
            kvStore.delete(key);
          },
        } as any,
        OAUTH_KV: {} as any,
      };

      const sessionManager = new SessionManager(mockEnv);
      const mockRequest = new Request("http://localhost/test");
      const context = await RequestContext.create(mockRequest, mockEnv);
      context.userId = "large-data-user";

      const largeData = {
        provider: "google" as const,
        userId: "large-data-user",
        email: "large@test.com",
        name: "User with lots of data",
        state: "x".repeat(1000),
        expiresAt: Date.now() + 3600000,
      };

      const startTime = Date.now();
      const sessionId = await sessionManager.createSession(largeData, context);
      const retrieved = await sessionManager.getSession(sessionId, context);
      const duration = Date.now() - startTime;

      expect(retrieved).toBeDefined();
      expect(retrieved!.state).toBe(largeData.state);
      expect(duration).toBeLessThan(50);
    });
  });
});
