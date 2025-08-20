// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserIndexManager } from "../user-index-manager";
import type { Env } from "../types";
import type { RequestContext } from "../../utils/request-context";

describe("UserIndexManager", () => {
  let manager: UserIndexManager;
  let mockEnv: Env;
  let mockContext: RequestContext;
  let kvStore: Map<string, string>;

  beforeEach(() => {
    kvStore = new Map();
    const kvMock = {
      get: vi.fn(async (key: string) => kvStore.get(key) || null),
      put: vi.fn(async (key: string, value: string) => { kvStore.set(key, value); }),
      delete: vi.fn(async (key: string) => { kvStore.delete(key); }),
    };

    mockEnv = {
      ALLOWED_ORIGINS: "http://localhost:3000",
      OAUTH_SESSIONS: kvMock as any,
      SESSION_ENCRYPTION_KEY: "test-key",
      SESSION_ENCRYPTION_SALT: "test-salt",
    };

    mockContext = { userId: "test-user", userEmail: "test@example.com" } as RequestContext;
    manager = new UserIndexManager(mockEnv);
  });

  describe("email index operations", () => {
    it("should set and get email index", async () => {
      await manager.setEmailIndex("user@example.com", "user-123", mockContext);
      const userId = await manager.getEmailIndex("user@example.com", mockContext);
      expect(userId).toBe("user-123");
    });

    it("should delete email index", async () => {
      await manager.setEmailIndex("user@example.com", "user-123", mockContext);
      await manager.deleteEmailIndex("user@example.com", mockContext);
      const userId = await manager.getEmailIndex("user@example.com", mockContext);
      expect(userId).toBeNull();
    });
  });

  describe("username index operations", () => {
    it("should set and get username index", async () => {
      await manager.setUsernameIndex("john-doe", "user-123", mockContext);
      const userId = await manager.getUsernameIndex("john-doe", mockContext);
      expect(userId).toBe("user-123");
    });

    it("should delete username index", async () => {
      await manager.setUsernameIndex("john-doe", "user-123", mockContext);
      await manager.deleteUsernameIndex("john-doe", mockContext);
      const userId = await manager.getUsernameIndex("john-doe", mockContext);
      expect(userId).toBeNull();
    });

    it("should check username availability", async () => {
      const available1 = await manager.checkUsernameAvailable("available", mockContext);
      expect(available1).toBe(true);
      
      await manager.setUsernameIndex("taken", "user-123", mockContext);
      const available2 = await manager.checkUsernameAvailable("taken", mockContext);
      expect(available2).toBe(false);
    });
  });

  describe("performance", () => {
    it("should complete operations within 50ms", async () => {
      const start = Date.now();
      await manager.setEmailIndex("user@example.com", "user-123", mockContext);
      await manager.getEmailIndex("user@example.com", mockContext);
      await manager.setUsernameIndex("john-doe", "user-123", mockContext);
      await manager.checkUsernameAvailable("john-doe", mockContext);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});