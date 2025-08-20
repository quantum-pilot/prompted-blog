// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProfileHandler } from "../profile-handler";
import type { Env } from "../types";
import type { RequestContext } from "../../utils/request-context";
import type { UserAccount } from "../../../../shared/contracts/user.contract";

describe("ProfileHandler", () => {
  let env: Env;
  let profileHandler: ProfileHandler;
  let mockContext: RequestContext;

  beforeEach(() => {
    env = {
      ALLOWED_ORIGINS: "http://localhost:3000",
      OAUTH_SESSIONS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
      } as unknown as KVNamespace,
      SESSION_ENCRYPTION_KEY: "test-key",
      SESSION_ENCRYPTION_SALT: "test-salt",
    };
    profileHandler = new ProfileHandler(env);
    mockContext = { userId: "user123", requestId: "req123" };
    
    // Mock the internal dependencies
    profileHandler.indexManager.getUserData = vi.fn();
    profileHandler.indexManager.setUserData = vi.fn();
    profileHandler.usernameChecker.isAvailable = vi.fn();
    profileHandler.usernameChecker.reserve = vi.fn();
    profileHandler.usernameChecker.confirmClaim = vi.fn();
    profileHandler.usernameChecker.release = vi.fn();
  });

  describe("getProfile", () => {
    it("should get user profile successfully", async () => {
      const userData: UserAccount = {
        id: "user123",
        email: "test@example.com",
        provider: "google",
        username: "testuser",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      (profileHandler.indexManager.getUserData as any).mockResolvedValue(JSON.stringify(userData));
      
      const result = await profileHandler.getProfile("user123", mockContext);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toEqual(userData);
      }
    });

    it("should return error when user not found", async () => {
      (profileHandler.indexManager.getUserData as any).mockResolvedValue(null);
      
      const result = await profileHandler.getProfile("user123", mockContext);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("user_not_found");
      }
    });
  });

  describe("updateProfile", () => {
    it("should update profile with username for first-time setup", async () => {
      const existingUser: UserAccount = {
        id: "user123",
        email: "test@example.com",
        provider: "google",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      (profileHandler.indexManager.getUserData as any).mockResolvedValue(JSON.stringify(existingUser));
      (profileHandler.usernameChecker.isAvailable as any).mockResolvedValue(true);
      (profileHandler.usernameChecker.reserve as any).mockResolvedValue(true);
      (profileHandler.usernameChecker.confirmClaim as any).mockResolvedValue(true);
      (profileHandler.indexManager.setUserData as any).mockResolvedValue(undefined);
      
      const result = await profileHandler.updateProfile(
        { id: "user123", username: "newusername" },
        mockContext
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.username).toBe("newusername");
        expect(result.user.id).toBe("user123");
      }
      
      // Verify atomic operations
      expect(profileHandler.usernameChecker.reserve).toHaveBeenCalled();
      expect(profileHandler.usernameChecker.confirmClaim).toHaveBeenCalled();
    });

    it("should reject username change when username already set", async () => {
      const existingUser: UserAccount = {
        id: "user123",
        email: "test@example.com",
        provider: "google",
        username: "existingusername",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      (profileHandler.indexManager.getUserData as any).mockResolvedValue(JSON.stringify(existingUser));
      
      const result = await profileHandler.updateProfile(
        { id: "user123", username: "newusername" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("profile_update_failed");
        expect(result.error_description).toContain("already has a username");
      }
    });

    it("should return username_taken error when username is unavailable", async () => {
      const existingUser: UserAccount = {
        id: "user123",
        email: "test@example.com",
        provider: "google",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      (profileHandler.indexManager.getUserData as any).mockResolvedValue(JSON.stringify(existingUser));
      (profileHandler.usernameChecker.isAvailable as any).mockResolvedValue(false);
      
      const result = await profileHandler.updateProfile(
        { id: "user123", username: "takenusername" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("username_taken");
      }
    });

    it("should validate username format", async () => {
      const existingUser: UserAccount = {
        id: "user123",
        email: "test@example.com",
        provider: "google",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      (profileHandler.indexManager.getUserData as any).mockResolvedValue(JSON.stringify(existingUser));
      
      const result = await profileHandler.updateProfile(
        { id: "user123", username: "Invalid-Username!" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("username_invalid");
      }
    });

    it("should handle concurrent updates atomically", async () => {
      const existingUser: UserAccount = {
        id: "user123",
        email: "test@example.com",
        provider: "google",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      (profileHandler.indexManager.getUserData as any).mockResolvedValue(JSON.stringify(existingUser));
      (profileHandler.usernameChecker.isAvailable as any).mockResolvedValue(true);
      (profileHandler.usernameChecker.reserve as any).mockResolvedValue(false); // Failed to reserve
      
      const result = await profileHandler.updateProfile(
        { id: "user123", username: "racecondition" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("username_taken");
      }
    });
  });

  describe("checkUsernameAvailability", () => {
    it("should return available when username is free", async () => {
      (profileHandler.usernameChecker.isAvailable as any).mockResolvedValue(true);
      
      const result = await profileHandler.checkUsernameAvailability(
        { username: "available" },
        mockContext
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.available).toBe(true);
      }
    });

    it("should return unavailable when username is taken", async () => {
      (profileHandler.usernameChecker.isAvailable as any).mockResolvedValue(false);
      
      const result = await profileHandler.checkUsernameAvailability(
        { username: "taken" },
        mockContext
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.available).toBe(false);
      }
    });

    it("should validate username format", async () => {
      const result = await profileHandler.checkUsernameAvailability(
        { username: "--invalid--" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("username_invalid");
      }
    });
  });

  describe("performance", () => {
    it("should complete profile update within 50ms", async () => {
      const existingUser: UserAccount = {
        id: "user123",
        email: "test@example.com",
        provider: "google",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      (profileHandler.indexManager.getUserData as any).mockImplementation(() => 
        Promise.resolve(JSON.stringify(existingUser))
      );
      (profileHandler.usernameChecker.isAvailable as any).mockImplementation(() => 
        Promise.resolve(true)
      );
      (profileHandler.usernameChecker.reserve as any).mockImplementation(() => 
        Promise.resolve(true)
      );
      (profileHandler.usernameChecker.confirmClaim as any).mockImplementation(() => 
        Promise.resolve(true)
      );
      (profileHandler.indexManager.setUserData as any).mockImplementation(() => 
        Promise.resolve()
      );
      
      const start = performance.now();
      await profileHandler.updateProfile(
        { id: "user123", username: "fastuser" },
        mockContext
      );
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });
  });
});