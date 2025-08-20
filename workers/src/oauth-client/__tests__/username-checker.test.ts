// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UsernameChecker } from "../username-checker";
import type { Env } from "../types";
import type { RequestContext } from "../../utils/request-context";

describe("UsernameChecker", () => {
  let checker: UsernameChecker;
  let mockEnv: Env;
  let mockContext: RequestContext;
  let kvStore: Map<string, { value: string; expiration?: number }>;

  beforeEach(() => {
    kvStore = new Map();
    
    mockEnv = {
      ALLOWED_ORIGINS: "http://localhost:3000",
      OAUTH_SESSIONS: {
        get: vi.fn(async (key: string) => {
          const item = kvStore.get(key);
          if (!item) return null;
          if (item.expiration && item.expiration < Date.now()) {
            kvStore.delete(key);
            return null;
          }
          return item.value;
        }),
        put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
          const expiration = options?.expirationTtl 
            ? Date.now() + (options.expirationTtl * 1000)
            : undefined;
          kvStore.set(key, { value, expiration });
        }),
        delete: vi.fn(async (key: string) => {
          kvStore.delete(key);
        }),
        list: vi.fn(),
        getWithMetadata: vi.fn()
      } as any,
      SESSION_ENCRYPTION_KEY: "test-key",
      SESSION_ENCRYPTION_SALT: "test-salt"
    };

    mockContext = {
      userId: "test-user",
      requestId: "test-request",
      request: new Request("http://test.com"),
      log: vi.fn()
    };

    checker = new UsernameChecker(mockEnv);
  });

  describe("isAvailable", () => {
    it("should return true for available username", async () => {
      const result = await checker.isAvailable("newusername", mockContext);
      expect(result).toBe(true);
    });

    it("should return false for taken username", async () => {
      await kvStore.set("user:username:taken", { value: "user123" });
      const result = await checker.isAvailable("taken", mockContext);
      expect(result).toBe(false);
    });

    it("should return false for reserved username", async () => {
      await kvStore.set("username:reserved:reserved", { value: "user456" });
      const result = await checker.isAvailable("reserved", mockContext);
      expect(result).toBe(false);
    });

    it("should return false for empty username", async () => {
      const result = await checker.isAvailable("", mockContext);
      expect(result).toBe(false);
    });
  });

  describe("reserve", () => {
    it("should reserve available username", async () => {
      const result = await checker.reserve("newusername", "user123", mockContext);
      expect(result).toBe(true);
      expect(kvStore.has("username:reserved:newusername")).toBe(true);
    });

    it("should not reserve already taken username", async () => {
      await kvStore.set("user:username:taken", { value: "user456" });
      const result = await checker.reserve("taken", "user123", mockContext);
      expect(result).toBe(false);
    });

    it("should not reserve already reserved username", async () => {
      await kvStore.set("username:reserved:reserved", { value: "user456" });
      const result = await checker.reserve("reserved", "user123", mockContext);
      expect(result).toBe(false);
    });

    it("should set TTL for reservation", async () => {
      const result = await checker.reserve("johndoe", "user123", mockContext);
      expect(result).toBe(true);
      // Verify that put was called with TTL
      expect(mockEnv.OAUTH_SESSIONS.put).toHaveBeenCalledWith(
        "username:reserved:johndoe",
        "user123",
        expect.objectContaining({ expirationTtl: 90 })
      );
    });
  });

  describe("confirmClaim", () => {
    it("should confirm claim for reserved username", async () => {
      await checker.reserve("myusername", "user123", mockContext);
      const result = await checker.confirmClaim("myusername", "user123", mockContext);
      expect(result).toBe(true);
      expect(kvStore.has("user:username:myusername")).toBe(true);
      expect(kvStore.has("username:reserved:myusername")).toBe(false);
    });

    it("should not confirm claim for wrong user", async () => {
      await checker.reserve("myusername", "user123", mockContext);
      const result = await checker.confirmClaim("myusername", "user456", mockContext);
      expect(result).toBe(false);
      expect(kvStore.has("user:username:myusername")).toBe(false);
    });

    it("should not confirm unreserved username", async () => {
      const result = await checker.confirmClaim("unreserved", "user123", mockContext);
      expect(result).toBe(false);
    });

    it("should handle race condition atomically", async () => {
      await checker.reserve("racename", "user123", mockContext);
      await kvStore.set("user:username:racename", { value: "user456" });
      const result = await checker.confirmClaim("racename", "user123", mockContext);
      expect(result).toBe(false);
    });
  });

  describe("release", () => {
    it("should release reserved username", async () => {
      await checker.reserve("alice", "user123", mockContext);
      await checker.release("alice", "user123", mockContext);
      expect(kvStore.has("username:reserved:alice")).toBe(false);
    });

    it("should not release username reserved by different user", async () => {
      await checker.reserve("alice", "user123", mockContext);
      const deleteCallsBefore = (mockEnv.OAUTH_SESSIONS.delete as any).mock.calls.length;
      
      // Try to release with different user - should not delete
      await checker.release("alice", "user456", mockContext);
      
      // Verify delete was not called (or called same number of times)
      const deleteCallsAfter = (mockEnv.OAUTH_SESSIONS.delete as any).mock.calls.length;
      expect(deleteCallsAfter).toBe(deleteCallsBefore);
    });

    it("should handle non-existent reservation gracefully", async () => {
      await expect(checker.release("nonexistent", "user123", mockContext))
        .resolves.not.toThrow();
    });
  });

  describe("performance", () => {
    it("should complete operations within 50ms", async () => {
      const start = performance.now();
      
      await checker.isAvailable("perftest", mockContext);
      await checker.reserve("perftest", "user123", mockContext);
      await checker.confirmClaim("perftest", "user123", mockContext);
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50);
    });
  });
});