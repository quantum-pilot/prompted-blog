// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionManager, SessionData } from "../session-manager";
import { RequestContext } from "../../utils/request-context";
import type { Env } from "../types";

describe("SessionManager Encryption", () => {
  let mockEnv: Env;
  let sessionManager: SessionManager;
  let context: RequestContext;

  beforeEach(async () => {
    // Create mock KV store with Map
    const kvStore = new Map<string, string>();

    // Generate a proper encryption key for testing (32 bytes)
    const testKey = "test-encryption-key-must-be-32-bytes-long-exactly!";

    mockEnv = {
      GOOGLE_CLIENT_ID: "test-google-client",
      CLIENT_ID: "test-client",
      REDIRECT_URI: "http://localhost:3000/callback",
      FRONTEND_URL: "http://localhost:3000",
      SESSION_ENCRYPTION_KEY: testKey,
      SESSION_ENCRYPTION_SALT: "test-salt-for-unit-tests",
      OAUTH_SESSIONS: {
        put: async (key: string, value: string, options?: any) => {
          kvStore.set(key, value);
        },
        get: async (key: string) => kvStore.get(key) || null,
        delete: async (key: string) => {
          kvStore.delete(key);
        },
      } as any,
      OAUTH_KV: {} as any,
    };

    sessionManager = new SessionManager(mockEnv);

    // Create a mock RequestContext for tests
    const mockRequest = new Request("http://localhost/test");
    context = await RequestContext.create(mockRequest, mockEnv);
    context.userId = "test-user";
  });

  describe("Session Encryption", () => {
    it("should encrypt session data before storing", async () => {
      const sessionData = {
        provider: "google" as const,
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        expiresAt: Date.now() + 3600000,
      };

      const sessionId = await sessionManager.createSession(
        sessionData,
        context
      );

      // Get raw value from KV store
      const rawValue = await mockEnv.OAUTH_SESSIONS.get(`session:${sessionId}`);

      expect(rawValue).toBeDefined();
      expect(rawValue).not.toContain("user-123"); // Should be encrypted
      expect(rawValue).not.toContain("test@example.com"); // Should be encrypted

      // Should contain base64 encoded data
      expect(rawValue).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("should decrypt session data when retrieving", async () => {
      const sessionData = {
        provider: "google" as const,
        userId: "user-456",
        email: "encrypted@example.com",
        name: "Encrypted User",
        picture: "https://example.com/pic.jpg",
        expiresAt: Date.now() + 3600000,
      };

      const sessionId = await sessionManager.createSession(
        sessionData,
        context
      );
      const retrieved = await sessionManager.getSession(sessionId, context);

      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe("user-456");
      expect(retrieved?.email).toBe("encrypted@example.com");
      expect(retrieved?.name).toBe("Encrypted User");
      expect(retrieved?.picture).toBe("https://example.com/pic.jpg");
    });

    it("should handle missing sessions gracefully", async () => {
      // Use a valid session ID format that doesn't exist
      const sessionId = "Abc123def456GHI789jkl012MNO345pqr678STU90XX";
      const retrieved = await sessionManager.getSession(sessionId, context);

      expect(retrieved).toBeNull();
    });

    it("should generate unique session IDs", async () => {
      const sessionData = {
        provider: "google" as const,
        userId: "user-789",
        email: "unique@example.com",
        expiresAt: Date.now() + 3600000,
      };

      const sessionId1 = await sessionManager.createSession(
        sessionData,
        context
      );
      const sessionId2 = await sessionManager.createSession(
        sessionData,
        context
      );

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1.length).toBeGreaterThan(20);
      expect(sessionId2.length).toBeGreaterThan(20);
    });
  });

  describe("OAuth State Encryption", () => {
    it("should encrypt OAuth state data", async () => {
      const stateData = {
        returnUrl: "/dashboard",
        timestamp: Date.now(),
      };

      await sessionManager.storeOAuthState("test-state", stateData, context);

      // Get raw value from KV store
      const rawValue = await mockEnv.OAUTH_SESSIONS.get("state:test-state");

      expect(rawValue).toBeDefined();
      expect(rawValue).not.toContain("dashboard"); // Should be encrypted
      expect(rawValue).not.toContain("returnUrl"); // Should be encrypted

      // Should contain base64 encoded data
      expect(rawValue).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("should decrypt OAuth state data", async () => {
      const stateData = {
        returnUrl: "/profile",
        timestamp: Date.now(),
        provider: "google",
      };

      await sessionManager.storeOAuthState("state_123", stateData, context);
      const retrieved = await sessionManager.getOAuthState(
        "state_123",
        context
      );

      expect(retrieved).toEqual(stateData);
    });

    it("should handle missing state gracefully", async () => {
      const retrieved = await sessionManager.getOAuthState(
        "bad-state",
        context
      );
      expect(retrieved).toBeNull();
    });

    it("should delete state after retrieval", async () => {
      const stateData = { test: "data" };
      const deleteSpy = vi.spyOn(mockEnv.OAUTH_SESSIONS, "delete");

      await sessionManager.storeOAuthState("temp-state", stateData, context);
      await sessionManager.getOAuthState("temp-state", context);

      expect(deleteSpy).toHaveBeenCalledWith("state:temp-state");
    });
  });

  describe("Encryption Edge Cases", () => {
    it("should handle large session data", async () => {
      const largeData = {
        provider: "google" as const,
        userId: "large-user",
        email: "large@example.com",
        name: "User with lots of data",
        // Add a large custom field
        state: "x".repeat(10000),
        expiresAt: Date.now() + 3600000,
      };

      const sessionId = await sessionManager.createSession(largeData, context);
      const retrieved = await sessionManager.getSession(sessionId, context);

      expect(retrieved).toBeDefined();
      expect(retrieved?.state).toBe(largeData.state);
    });

    it("should handle special characters in data", async () => {
      const specialData = {
        provider: "google" as const,
        userId: "special-user",
        email: "special@example.com",
        name: "测试用户 🎉", // Unicode and emoji
        state: JSON.stringify({ nested: { data: 'with "quotes"' } }),
        expiresAt: Date.now() + 3600000,
      };

      const sessionId = await sessionManager.createSession(
        specialData,
        context
      );
      const retrieved = await sessionManager.getSession(sessionId, context);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("测试用户 🎉");
      expect(retrieved?.state).toBe(specialData.state);
    });
  });

  describe("Encryption Consistency", () => {
    it("should use different encryption for each session", async () => {
      const sessionData = {
        provider: "google" as const,
        userId: "consistent-user",
        email: "consistent@example.com",
        expiresAt: Date.now() + 3600000,
      };

      // Create two managers with the same key
      const sessionManager1 = new SessionManager(mockEnv);
      const sessionManager2 = new SessionManager(mockEnv);

      const sessionId1 = await sessionManager1.createSession(
        sessionData,
        context
      );
      const sessionId2 = await sessionManager2.createSession(
        sessionData,
        context
      );

      // Get raw encrypted values
      const raw1 = await mockEnv.OAUTH_SESSIONS.get(`session:${sessionId1}`);
      const raw2 = await mockEnv.OAUTH_SESSIONS.get(`session:${sessionId2}`);

      // Same data should produce different encrypted results (due to different IVs)
      expect(raw1).not.toBe(raw2);

      // But both should decrypt correctly
      const retrieved1 = await sessionManager1.getSession(sessionId1, context);
      const retrieved2 = await sessionManager2.getSession(sessionId2, context);

      expect(retrieved1?.userId).toBe("consistent-user");
      expect(retrieved2?.userId).toBe("consistent-user");
    });

    it("should handle concurrent session operations", async () => {
      const sessions: string[] = [];
      const promises = [];

      // Create multiple sessions concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          sessionManager.createSession(
            {
              provider: "google" as const,
              userId: `concurrent-user-${i}`,
              email: `user${i}@example.com`,
              expiresAt: Date.now() + 3600000,
            },
            context
          )
        );
      }

      const sessionIds = await Promise.all(promises);
      sessions.push(...sessionIds);

      // Retrieve all sessions concurrently
      const retrievalPromises = sessions.map((id, i) =>
        sessionManager.getSession(sessions[i], context)
      );

      const retrieved = await Promise.all(retrievalPromises);

      // All should be retrieved correctly
      retrieved.forEach((session, i) => {
        expect(session?.userId).toBe(`concurrent-user-${i}`);
      });
    });
  });

  describe("Encryption Key Management", () => {
    it("should handle missing encryption key gracefully", async () => {
      const envWithoutKey = { ...mockEnv, SESSION_ENCRYPTION_KEY: undefined };
      const managerWithoutKey = new SessionManager(envWithoutKey as any);

      await expect(
        managerWithoutKey.createSession(
          {
            provider: "google" as const,
            userId: "test-user",
            email: "test@example.com",
            expiresAt: Date.now() + 3600000,
          },
          context
        )
      ).rejects.toThrow();
    });

    it("should handle different encryption keys", async () => {
      const envWithDifferentKey = {
        ...mockEnv,
        SESSION_ENCRYPTION_KEY: "different-key",
      };
      const managerWithDifferentKey = new SessionManager(envWithDifferentKey);

      // Should still be able to create a session with a different key
      const sessionId = await managerWithDifferentKey.createSession(
        {
          provider: "google" as const,
          userId: "test-user",
          email: "test@example.com",
          expiresAt: Date.now() + 3600000,
        },
        context
      );

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("OAuth State Encryption", () => {
    it("should still delete state after failed decryption", async () => {
      // Store corrupted data directly
      await mockEnv.OAUTH_SESSIONS.put(
        "state:corrupted",
        "invalid-encrypted-data"
      );

      const deleteSpy = vi.spyOn(mockEnv.OAUTH_SESSIONS, "delete");
      const retrieved = await sessionManager.getOAuthState(
        "corrupted",
        context
      );

      expect(retrieved).toBeNull();
      expect(deleteSpy).toHaveBeenCalledWith("state:corrupted");
    });
  });
});
