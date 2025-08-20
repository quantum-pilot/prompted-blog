// @agent: cloudflare-backend
import { describe, it, expect } from "vitest";
import { ProfileHandler } from "../profile-handler";
import type { Env } from "../types";
import type { RequestContext } from "../../utils/request-context";

describe("ProfileHandler Integration", () => {
  it("demonstrates complete profile update flow", async () => {
    // This test demonstrates the ProfileHandler workflow
    // In production, this would integrate with real KV storage
    
    const mockEnv: Env = {
      ALLOWED_ORIGINS: "http://localhost:3000",
      OAUTH_SESSIONS: {} as KVNamespace,
      SESSION_ENCRYPTION_KEY: "test-key",
      SESSION_ENCRYPTION_SALT: "test-salt",
    };
    
    const handler = new ProfileHandler(mockEnv);
    const context: RequestContext = { userId: "user123", requestId: "req123" };
    
    // Mock the internal services
    handler.indexManager.getUserData = async () => JSON.stringify({
      id: "user123",
      email: "test@example.com",
      provider: "google",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    handler.indexManager.setUserData = async () => {};
    handler.usernameChecker.isAvailable = async () => true;
    handler.usernameChecker.reserve = async () => true;
    handler.usernameChecker.confirmClaim = async () => true;
    
    // Execute profile update
    const result = await handler.updateProfile(
      { id: "user123", username: "newuser" },
      context
    );
    
    // Verify success
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.username).toBe("newuser");
      expect(result.user.id).toBe("user123");
    }
  });
  
  it("demonstrates username availability check", async () => {
    const mockEnv: Env = {
      ALLOWED_ORIGINS: "http://localhost:3000",
      OAUTH_SESSIONS: {} as KVNamespace,
      SESSION_ENCRYPTION_KEY: "test-key",
      SESSION_ENCRYPTION_SALT: "test-salt",
    };
    
    const handler = new ProfileHandler(mockEnv);
    const context: RequestContext = { userId: "user123", requestId: "req123" };
    
    handler.usernameChecker.isAvailable = async (username) => username !== "taken";
    
    // Check available username
    const available = await handler.checkUsernameAvailability(
      { username: "available" },
      context
    );
    expect(available.success).toBe(true);
    if (available.success) expect(available.available).toBe(true);
    
    // Check taken username
    const taken = await handler.checkUsernameAvailability(
      { username: "taken" },
      context
    );
    expect(taken.success).toBe(true);
    if (taken.success) expect(taken.available).toBe(false);
  });
});