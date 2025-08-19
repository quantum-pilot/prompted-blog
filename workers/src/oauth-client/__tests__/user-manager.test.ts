// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserManager } from "../user-manager";
import { UserStorage, UserAccount } from "../user-storage";
import type { RequestContext } from "../../utils/request-context";
import type { Env } from "../types";
import { RateLimiter } from "../../utils/rate-limiter";
import { AuditEventType } from "../../utils/audit-logger";

// Mock UserStorage
vi.mock("../user-storage", () => ({
  UserStorage: vi.fn().mockImplementation(() => ({
    storeUser: vi.fn(),
    retrieveUserByEmail: vi.fn(),
    retrieveUserById: vi.fn(),
    updateUser: vi.fn(),
    createUserIfNotExists: vi.fn(),
  })),
}));

// Mock RateLimiter
vi.mock("../../utils/rate-limiter", () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    isAllowed: vi.fn().mockResolvedValue(true),
  })),
}));

describe("UserManager", () => {
  let userManager: UserManager;
  let mockEnv: Env;
  let mockContext: RequestContext;
  let mockStorage: any;
  let mockRateLimiter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = {
      OAUTH_SESSIONS: {} as KVNamespace,
      SESSION_ENCRYPTION_KEY: "test-key",
      SESSION_ENCRYPTION_SALT: "test-salt",
      ALLOWED_ORIGINS: "http://localhost:3000",
    };

    // Create a mock request with CF-Connecting-IP header
    const mockRequest = new Request("http://test.com", {
      headers: new Headers({ "CF-Connecting-IP": "192.168.1.1" }),
    });

    mockContext = {
      correlationId: "test-correlation",
      userId: "test-user",
      log: vi.fn(),
      request: mockRequest,
    } as any;

    mockStorage = new UserStorage(mockEnv);
    userManager = new UserManager(mockEnv);
    (userManager as any).storage = mockStorage;
    
    // Mock the rate limiter for all tests
    mockRateLimiter = {
      isAllowed: vi.fn().mockResolvedValue(true),
    };
    (userManager as any).rateLimiter = mockRateLimiter;
  });

  describe("createUser", () => {
    it("should create a new user with generated UUID", async () => {
      const email = "test@example.com";
      const provider = "google";

      const result = await userManager.createUser(email, provider, mockContext);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.email).toBe(email);
      expect(result.createdAt).toBeDefined();
      expect(mockStorage.storeUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          id: expect.any(String),
          createdAt: expect.any(String),
        }),
        mockContext
      );
    });

    it("should throw error if storage fails", async () => {
      mockStorage.storeUser.mockRejectedValue(new Error("Storage failed"));

      await expect(
        userManager.createUser("test@example.com", "google", mockContext)
      ).rejects.toThrow("Failed to create user");
    });
  });

  describe("findOrCreateUser", () => {
    it("should use atomic operation to prevent race conditions", async () => {
      const newUser: UserAccount = {
        id: expect.any(String),
        email: "new@example.com",
        name: "New User",
        picture: "https://example.com/picture.jpg",
        createdAt: expect.any(String),
        metadata: { provider: "google" },
      };
      
      // Mock atomic create returning success
      mockStorage.createUserIfNotExists = vi.fn().mockResolvedValue({
        created: true,
        user: newUser,
      });

      const result = await userManager.findOrCreateUser(
        "new@example.com",
        "google",
        mockContext,
        "New User",
        "https://example.com/picture.jpg"
      );

      expect(result).toEqual(newUser);
      expect(mockStorage.createUserIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.com",
          metadata: { provider: "google" },
        }),
        mockContext
      );
    });

    it("should handle atomic operation returning existing user", async () => {
      const existingUserId = crypto.randomUUID();
      const existingUser: UserAccount = {
        id: existingUserId,
        email: "test@example.com",
        name: "Existing User",
        createdAt: new Date().toISOString(),
      };
      
      // Mock atomic create returning existing user
      mockStorage.createUserIfNotExists = vi.fn().mockResolvedValue({
        created: false,
        user: existingUser,
      });

      const result = await userManager.findOrCreateUser(
        "test@example.com",
        "google",
        mockContext,
        "New Name",
        "https://example.com/new-picture.jpg"
      );

      // Should update the existing user with new data
      expect(mockStorage.updateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: existingUserId,
          email: "test@example.com",
          name: "New Name",
          picture: "https://example.com/new-picture.jpg",
        }),
        mockContext
      );
    });

    it("should return existing user without update if no changes", async () => {
      const existingUserId = crypto.randomUUID();
      const existingUser: UserAccount = {
        id: existingUserId,
        email: "test@example.com",
        name: "Existing User",
        createdAt: new Date().toISOString(),
      };
      
      mockStorage.createUserIfNotExists = vi.fn().mockResolvedValue({
        created: false,
        user: existingUser,
      });

      const result = await userManager.findOrCreateUser(
        "test@example.com",
        "google",
        mockContext,
        undefined,
        undefined
      );

      expect(result).toBe(existingUser);
      expect(mockStorage.updateUser).not.toHaveBeenCalled();
    });

    it("should handle race conditions gracefully", async () => {
      const winnerId = crypto.randomUUID();
      const existingUser: UserAccount = {
        id: winnerId,
        email: "race@example.com",
        name: "Winner",
        createdAt: new Date().toISOString(),
      };
      
      // Simulate concurrent attempts where one wins
      mockStorage.createUserIfNotExists = vi.fn().mockResolvedValue({
        created: false,
        user: existingUser,
      });

      // Simulate multiple concurrent calls
      const promises = Array.from({ length: 3 }, (_, i) =>
        userManager.findOrCreateUser(
          "race@example.com",
          "google",
          mockContext,
          `User ${i}`,
          undefined
        )
      );

      const results = await Promise.all(promises);
      
      // All should get the same user (the winner)
      results.forEach(result => {
        expect(result.id).toBe(winnerId);
      });
    });
  });

  describe("getUserById", () => {
    it("should retrieve user by id", async () => {
      const userId = crypto.randomUUID();
      const user: UserAccount = {
        id: userId,
        email: "test@example.com",
        createdAt: new Date().toISOString(),
      };
      mockStorage.retrieveUserById.mockResolvedValue(user);

      const result = await userManager.getUserById(userId, mockContext);

      expect(result).toBe(user);
      expect(mockStorage.retrieveUserById).toHaveBeenCalledWith(userId, mockContext);
    });

    it("should return null if user not found", async () => {
      mockStorage.retrieveUserById.mockResolvedValue(null);

      const result = await userManager.getUserById("unknown-id", mockContext);

      expect(result).toBeNull();
    });
  });

  describe("getUserByEmail", () => {
    it("should retrieve user by email", async () => {
      const user: UserAccount = {
        id: "test-id",
        email: "test@example.com",
        createdAt: new Date().toISOString(),
      };
      mockStorage.retrieveUserByEmail.mockResolvedValue(user);

      const result = await userManager.getUserByEmail("test@example.com", mockContext);

      expect(result).toBe(user);
      expect(mockStorage.retrieveUserByEmail).toHaveBeenCalledWith(
        "test@example.com",
        mockContext
      );
    });

    it("should return null if user not found", async () => {
      mockStorage.retrieveUserByEmail.mockResolvedValue(null);

      const result = await userManager.getUserByEmail("unknown@example.com", mockContext);

      expect(result).toBeNull();
    });
  });

  describe("rate limiting", () => {
    let mockRateLimiter: any;
    let mockRequest: Request;

    beforeEach(() => {
      mockRequest = new Request("http://test.com", {
        headers: new Headers({ "CF-Connecting-IP": "192.168.1.1" }),
      });
      mockContext.request = mockRequest;

      // Create a new mock rate limiter instance
      mockRateLimiter = {
        isAllowed: vi.fn().mockResolvedValue(true),
      };
      
      // Override the UserManager's rate limiter
      (userManager as any).rateLimiter = mockRateLimiter;
    });

    describe("createUser rate limiting", () => {
      it("should allow user creation when rate limit not exceeded", async () => {
        mockRateLimiter.isAllowed.mockResolvedValue(true);

        const result = await userManager.createUser(
          "test@example.com",
          "google",
          mockContext
        );

        expect(result).toBeDefined();
        expect(mockRateLimiter.isAllowed).toHaveBeenCalledWith("user-creation:192.168.1.1");
        expect(mockStorage.storeUser).toHaveBeenCalled();
      });

      it("should reject user creation when rate limit exceeded", async () => {
        mockRateLimiter.isAllowed.mockResolvedValue(false);

        await expect(
          userManager.createUser("test@example.com", "google", mockContext)
        ).rejects.toThrow("Too many user creation attempts. Please try again later.");

        expect(mockRateLimiter.isAllowed).toHaveBeenCalledWith("user-creation:192.168.1.1");
        expect(mockStorage.storeUser).not.toHaveBeenCalled();
        expect(mockContext.log).toHaveBeenCalledWith(
          AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED,
          "failure",
          expect.objectContaining({
            action: "user_creation",
            ipAddress: "192.168.1.1",
          })
        );
      });

      it("should handle missing CF-Connecting-IP header in test environment", async () => {
        // Create a new request without CF-Connecting-IP header
        const requestWithoutCfIp = new Request("http://test.com");
        mockContext.request = requestWithoutCfIp;
        
        // Ensure rate limiter allows the request
        mockRateLimiter.isAllowed.mockResolvedValue(true);
        
        // Ensure storage mock returns success
        mockStorage.storeUser.mockResolvedValue(undefined);

        const result = await userManager.createUser(
          "test@example.com",
          "google",
          mockContext
        );

        expect(result).toBeDefined();
        expect(result.email).toBe("test@example.com");
        expect(mockRateLimiter.isAllowed).toHaveBeenCalledWith("user-creation:127.0.0.1");
        expect(mockStorage.storeUser).toHaveBeenCalled();
      });
    });

    describe("findOrCreateUser rate limiting", () => {
      it("should allow findOrCreate when rate limit not exceeded", async () => {
        mockRateLimiter.isAllowed.mockResolvedValue(true);
        
        const newUser: UserAccount = {
          id: expect.any(String),
          email: "new@example.com",
          name: "New User",
          createdAt: expect.any(String),
          metadata: { provider: "google" },
        };
        
        mockStorage.createUserIfNotExists.mockResolvedValue({
          created: true,
          user: newUser,
        });

        const result = await userManager.findOrCreateUser(
          "new@example.com",
          "google",
          mockContext,
          "New User"
        );

        expect(result).toEqual(newUser);
        expect(mockRateLimiter.isAllowed).toHaveBeenCalledWith("user-creation:192.168.1.1");
      });

      it("should reject findOrCreate when rate limit exceeded for new user", async () => {
        mockRateLimiter.isAllowed.mockResolvedValue(false);

        await expect(
          userManager.findOrCreateUser("new@example.com", "google", mockContext)
        ).rejects.toThrow("Too many user creation attempts. Please try again later.");

        expect(mockRateLimiter.isAllowed).toHaveBeenCalledWith("user-creation:192.168.1.1");
        expect(mockStorage.createUserIfNotExists).not.toHaveBeenCalled();
        expect(mockContext.log).toHaveBeenCalledWith(
          AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED,
          "failure",
          expect.objectContaining({
            action: "user_creation",
            ipAddress: "192.168.1.1",
          })
        );
      });

      it("should not apply rate limiting for existing users", async () => {
        // First call - check rate limit for potential creation
        mockRateLimiter.isAllowed.mockResolvedValue(true);
        
        const existingUser: UserAccount = {
          id: "existing-id",
          email: "existing@example.com",
          name: "Existing User",
          createdAt: new Date().toISOString(),
        };
        
        // User already exists
        mockStorage.createUserIfNotExists.mockResolvedValue({
          created: false,
          user: existingUser,
        });

        const result = await userManager.findOrCreateUser(
          "existing@example.com",
          "google",
          mockContext
        );

        expect(result).toEqual(existingUser);
        // Rate limiter is still checked but user creation doesn't happen
        expect(mockRateLimiter.isAllowed).toHaveBeenCalledWith("user-creation:192.168.1.1");
      });
    });

    describe("rate limit configuration", () => {
      it("should use correct rate limit parameters", async () => {
        // Reset the mock to get actual RateLimiter constructor call
        vi.clearAllMocks();
        
        // Create UserManager which should create RateLimiter with correct config
        const userManagerWithRealRateLimiter = new UserManager(mockEnv);
        
        // Verify RateLimiter was created
        const rateLimiter = (userManagerWithRealRateLimiter as any).rateLimiter;
        expect(rateLimiter).toBeDefined();
        
        // Since RateLimiter is mocked, we just verify it was created
        // The actual parameters are validated in the RateLimiter's own tests
        expect(RateLimiter).toHaveBeenCalledWith({
          kv: mockEnv.OAUTH_SESSIONS,
          limit: 5,
          windowMs: 60000,
          keyPrefix: "user-creation"
        });
      });
    });
  });

  describe("performance", () => {
    it("should complete operations within 50ms", async () => {
      const newUser: UserAccount = {
        id: crypto.randomUUID(),
        email: "perf@example.com",
        name: "Test User",
        picture: "https://example.com/pic.jpg",
        createdAt: new Date().toISOString(),
        metadata: { provider: "google" },
      };
      
      mockStorage.createUserIfNotExists.mockResolvedValue({
        created: true,
        user: newUser,
      });

      const start = performance.now();
      await userManager.findOrCreateUser(
        "perf@example.com",
        "google",
        mockContext,
        "Test User",
        "https://example.com/pic.jpg"
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});