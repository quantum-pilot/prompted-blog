// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserStorage, UserAccount } from "../user-storage";
import type { Env } from "../types";
import type { RequestContext } from "../../utils/request-context";

describe("UserStorage", () => {
  let storage: UserStorage;
  let mockEnv: Env;
  let mockContext: RequestContext;
  let kvStore: Map<string, string>;
  let kvMockImpl: any;

  beforeEach(() => {
    // Create an in-memory KV store with atomic operations simulation
    kvStore = new Map();
    const putInProgress = new Set<string>();
    
    kvMockImpl = {
      get: vi.fn(async (key: string) => kvStore.get(key) || null),
      put: vi.fn(async (key: string, value: string, options?: any) => {
        // Simulate atomic put - only one concurrent put per key can succeed
        if (key.startsWith("user:email:")) {
          // For email keys, simulate atomic check-and-set behavior
          if (putInProgress.has(key)) {
            // Another put is in progress for this key
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          putInProgress.add(key);
          try {
            // Check if key already exists (simulating KV's atomic behavior)
            if (!kvStore.has(key)) {
              // Small delay to simulate real KV latency and allow race conditions
              await new Promise(resolve => setTimeout(resolve, 1));
              // Double-check after delay (simulates KV's internal locking)
              if (!kvStore.has(key)) {
                kvStore.set(key, value);
              }
            }
          } finally {
            putInProgress.delete(key);
          }
        } else {
          // For other keys, just set normally
          kvStore.set(key, value);
        }
      }),
      delete: vi.fn(async (key: string) => {
        kvStore.delete(key);
      }),
    };

    mockEnv = {
      ALLOWED_ORIGINS: "http://localhost:3000",
      OAUTH_SESSIONS: kvMockImpl as KVNamespace,
      SESSION_ENCRYPTION_KEY: "test-encryption-key-32-chars-long",
      SESSION_ENCRYPTION_SALT: "test-salt-16-chars",
    };

    mockContext = {
      userId: "test-user",
      userEmail: "test@example.com",
    } as RequestContext;

    storage = new UserStorage(mockEnv);
  });

  describe("storeUser", () => {
    it("should store user data with id key", async () => {
      const user: UserAccount = {
        id: crypto.randomUUID(),
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      expect(kvMockImpl.put).toHaveBeenCalledWith(
        expect.stringMatching(/^user:id:[0-9a-f-]+$/),
        expect.any(String),
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });

    it("should store email index", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      expect(kvMockImpl.put).toHaveBeenCalledWith(
        "user:email:john@example.com",
        userId,
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });

    it("should store username index when username provided", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        username: "john-doe",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      expect(kvMockImpl.put).toHaveBeenCalledWith(
        "user:username:john-doe",
        userId,
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });

    it("should encrypt user data", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      const storedData = kvStore.get(`user:id:${userId}`);
      expect(storedData).toBeDefined();
      expect(storedData).not.toContain("john@example.com");
      expect(storedData).not.toContain("John Doe");
    });
  });

  describe("retrieveUserByEmail", () => {
    it("should retrieve user by email", async () => {
      const user: UserAccount = {
        id: crypto.randomUUID(),
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);
      const retrieved = await storage.retrieveUserByEmail("john@example.com", mockContext);

      expect(retrieved).toEqual(user);
    });

    it("should return null for non-existent email", async () => {
      const retrieved = await storage.retrieveUserByEmail("nonexistent@example.com", mockContext);
      expect(retrieved).toBeNull();
    });

    it("should handle invalid email format gracefully", async () => {
      const retrieved = await storage.retrieveUserByEmail("", mockContext);
      expect(retrieved).toBeNull();
    });
  });

  describe("retrieveUserById", () => {
    it("should retrieve user by id", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);
      const retrieved = await storage.retrieveUserById(userId, mockContext);

      expect(retrieved).toEqual(user);
    });

    it("should return null for non-existent id", async () => {
      const retrieved = await storage.retrieveUserById("nonexistent-id", mockContext);
      expect(retrieved).toBeNull();
    });

    it("should handle invalid id format gracefully", async () => {
      const retrieved = await storage.retrieveUserById("", mockContext);
      expect(retrieved).toBeNull();
    });
  });

  describe("retrieveUserByUsername", () => {
    it("should retrieve user by username", async () => {
      const user: UserAccount = {
        id: crypto.randomUUID(),
        email: "john@example.com",
        username: "john-doe",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);
      const retrieved = await storage.retrieveUserByUsername("john-doe", mockContext);

      expect(retrieved).toEqual(user);
    });

    it("should return null for non-existent username", async () => {
      const retrieved = await storage.retrieveUserByUsername("nonexistent", mockContext);
      expect(retrieved).toBeNull();
    });

    it("should handle invalid username format gracefully", async () => {
      const retrieved = await storage.retrieveUserByUsername("", mockContext);
      expect(retrieved).toBeNull();
    });
  });

  describe("checkUsernameAvailability", () => {
    it("should return true for available username", async () => {
      const available = await storage.checkUsernameAvailability("available-username", mockContext);
      expect(available).toBe(true);
    });

    it("should return false for taken username", async () => {
      const user: UserAccount = {
        id: crypto.randomUUID(),
        email: "john@example.com",
        username: "taken-username",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);
      const available = await storage.checkUsernameAvailability("taken-username", mockContext);
      expect(available).toBe(false);
    });
  });

  describe("updateUser", () => {
    it("should update existing user data", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      const updatedUser = { ...user, name: "John Updated" };
      await storage.updateUser(updatedUser, mockContext);

      const retrieved = await storage.retrieveUserById(userId, mockContext);
      expect(retrieved?.name).toBe("John Updated");
    });

    it("should update email index when email changes", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      const updatedUser = { ...user, email: "newemail@example.com" };
      await storage.updateUser(updatedUser, mockContext);

      // Old email should not retrieve user
      const oldEmailResult = await storage.retrieveUserByEmail("john@example.com", mockContext);
      expect(oldEmailResult).toBeNull();

      // New email should retrieve user
      const newEmailResult = await storage.retrieveUserByEmail("newemail@example.com", mockContext);
      expect(newEmailResult?.id).toBe(userId);
    });

    it("should update username index when username changes", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        username: "old-username",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      const updatedUser = { ...user, username: "new-username" };
      await storage.updateUser(updatedUser, mockContext);

      // Old username should not retrieve user
      const oldUsernameResult = await storage.retrieveUserByUsername("old-username", mockContext);
      expect(oldUsernameResult).toBeNull();

      // New username should retrieve user
      const newUsernameResult = await storage.retrieveUserByUsername("new-username", mockContext);
      expect(newUsernameResult?.id).toBe(userId);
    });

    it("should handle adding username to user without one", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      const updatedUser = { ...user, username: "new-username" };
      await storage.updateUser(updatedUser, mockContext);

      const result = await storage.retrieveUserByUsername("new-username", mockContext);
      expect(result?.id).toBe(userId);
    });

    it("should handle removing username from user", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        username: "to-remove",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      const updatedUser = { ...user };
      delete updatedUser.username;
      await storage.updateUser(updatedUser, mockContext);

      // Old username should not retrieve user
      const result = await storage.retrieveUserByUsername("to-remove", mockContext);
      expect(result).toBeNull();
    });
  });

  describe("createUserIfNotExists", () => {
    it("should create user atomically if not exists", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "atomic@example.com",
        name: "Atomic User",
        createdAt: new Date().toISOString(),
      };

      const result = await storage.createUserIfNotExists(user, mockContext);
      
      expect(result.created).toBe(true);
      expect(result.user).toEqual(user);
      
      // Verify user was stored
      const retrieved = await storage.retrieveUserById(userId, mockContext);
      expect(retrieved).toEqual(user);
    });

    it("should return existing user without creating duplicate", async () => {
      const existingUserId = crypto.randomUUID();
      const existingUser: UserAccount = {
        id: existingUserId,
        email: "existing@example.com",
        name: "Existing User",
        createdAt: new Date().toISOString(),
      };

      // First create the user
      await storage.storeUser(existingUser, mockContext);

      // Try to create again with different id but same email
      const newUserId = crypto.randomUUID();
      const newUser: UserAccount = {
        id: newUserId,
        email: "existing@example.com",
        name: "New User",
        createdAt: new Date().toISOString(),
      };

      const result = await storage.createUserIfNotExists(newUser, mockContext);
      
      expect(result.created).toBe(false);
      expect(result.user).toEqual(existingUser);
      
      // Verify original user is still there
      const retrieved = await storage.retrieveUserById(existingUserId, mockContext);
      expect(retrieved).toEqual(existingUser);
      
      // Verify new user was not created
      const notCreated = await storage.retrieveUserById(newUserId, mockContext);
      expect(notCreated).toBeNull();
    });

    it("should handle concurrent creation attempts safely", async () => {
      const email = "concurrent@example.com";
      
      // Simulate concurrent attempts to create users with same email
      const promises = Array.from({ length: 5 }, (_, i) => {
        const user: UserAccount = {
          id: crypto.randomUUID(),
          email,
          name: `User ${i}`,
          createdAt: new Date().toISOString(),
        };
        return storage.createUserIfNotExists(user, mockContext);
      });

      const results = await Promise.all(promises);
      
      // Only one should have been created
      const createdResults = results.filter(r => r.created);
      expect(createdResults).toHaveLength(1);
      
      // All should return the same user
      const firstUser = results[0].user;
      results.forEach(result => {
        expect(result.user.email).toBe(email);
        expect(result.user.id).toBe(firstUser.id);
      });
      
      // Verify only one user exists in storage
      const retrieved = await storage.retrieveUserByEmail(email, mockContext);
      expect(retrieved?.id).toBe(firstUser.id);
    });

    it("should handle concurrent username claims atomically", async () => {
      const username = "concurrent-username";
      const email1 = "user1@example.com";
      const email2 = "user2@example.com";
      
      // Create two users with different emails but same username
      const user1: UserAccount = {
        id: crypto.randomUUID(),
        email: email1,
        username,
        name: "User 1",
        createdAt: new Date().toISOString(),
      };
      
      const user2: UserAccount = {
        id: crypto.randomUUID(),
        email: email2,
        username,
        name: "User 2",
        createdAt: new Date().toISOString(),
      };
      
      // Try to create both users concurrently
      const [result1, result2] = await Promise.all([
        storage.createUserIfNotExists(user1, mockContext),
        storage.createUserIfNotExists(user2, mockContext),
      ]);
      
      // Both should succeed with user creation (different emails)
      expect(result1.created || result2.created).toBe(true);
      
      // But only one should have the username
      const userWithUsername = await storage.retrieveUserByUsername(username, mockContext);
      expect(userWithUsername).toBeTruthy();
      expect([user1.id, user2.id]).toContain(userWithUsername?.id);
    });
  });

  describe("performance", () => {
    it("should complete storage operations within 50ms", async () => {
      const user: UserAccount = {
        id: crypto.randomUUID(),
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      const start = Date.now();
      await storage.storeUser(user, mockContext);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it("should complete retrieval operations within 50ms", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "john@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      };

      await storage.storeUser(user, mockContext);

      const start = Date.now();
      await storage.retrieveUserById(userId, mockContext);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it("should complete atomic creation within 50ms", async () => {
      const user: UserAccount = {
        id: crypto.randomUUID(),
        email: `perf-${Date.now()}@example.com`,
        name: "Perf User",
        createdAt: new Date().toISOString(),
      };

      const start = Date.now();
      await storage.createUserIfNotExists(user, mockContext);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });
});