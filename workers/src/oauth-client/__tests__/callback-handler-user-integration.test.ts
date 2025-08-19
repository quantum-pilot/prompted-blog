// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleCallbackWithParams } from "../callback-handler";
import { UserManager } from "../user-manager";
import { SessionManager } from "../session-manager";
import type { Env } from "../types";
import type { RequestContext } from "../../utils/request-context";
import * as oauthHandler from "../oauth-handler";

// Mock dependencies
vi.mock("../user-manager");
vi.mock("../session-manager");
vi.mock("../oauth-handler");

describe("Callback Handler User Integration", () => {
  let env: Env;
  let context: RequestContext;
  let mockUserManager: any;
  let mockSessionManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    env = {
      OAUTH_SESSIONS: {} as KVNamespace,
      SESSION_ENCRYPTION_KEY: "test-key-32-chars-long-for-testing",
      SESSION_ENCRYPTION_SALT: "test-salt",
      ALLOWED_ORIGINS: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "test-client-id",
      REDIRECT_URI: "http://localhost:3000/callback",
    };

    context = {
      correlationId: "test-correlation",
      log: vi.fn(),
      origin: "http://localhost:3000",
      method: "POST",
      request: new Request("http://localhost/callback"),
    } as any;

    // Setup mock user manager
    mockUserManager = {
      findOrCreateUser: vi.fn().mockResolvedValue({
        id: "user-uuid-123",
        email: "test@example.com",
        name: "Test User",
        picture: "https://example.com/picture.jpg",
        createdAt: new Date().toISOString(),
      }),
    };
    (UserManager as any).mockImplementation(() => mockUserManager);

    // Setup mock session manager
    mockSessionManager = {
      createSession: vi.fn().mockResolvedValue("session-id-456"),
    };
    (SessionManager as any).mockImplementation(() => mockSessionManager);
  });

  describe("User Account Integration", () => {
    it("should create/find user account and use persistent user ID in session", async () => {
      // Mock successful OAuth response
      const oauthResponse = {
        status: 200,
        json: async () => ({
          success: true,
          session: {
            userId: "oauth-provider-sub-123", // OAuth provider's sub claim
            email: "test@example.com",
            name: "Test User",
            picture: "https://example.com/picture.jpg",
            provider: "google",
            expiresAt: Date.now() + 3600000,
            state: "test-state",
          },
        }),
      };
      vi.spyOn(oauthHandler, "handleOAuthCallbackWithParams").mockResolvedValue(
        oauthResponse as Response
      );

      const params = {
        code: "test-code",
        state: "test-state",
        codeVerifier: "test-verifier",
        provider: "google",
      };

      const response = await handleCallbackWithParams(params, env, context);
      const responseData = await response.json();

      // Verify UserManager was called with OAuth data
      expect(mockUserManager.findOrCreateUser).toHaveBeenCalledWith(
        "test@example.com",
        "google",
        context,
        "Test User",
        "https://example.com/picture.jpg"
      );

      // Verify session was created with persistent user ID
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-uuid-123", // Our persistent user ID, not OAuth sub
          oauthSub: "oauth-provider-sub-123", // OAuth sub stored separately
          email: "test@example.com",
          name: "Test User",
          picture: "https://example.com/picture.jpg",
          provider: "google",
        }),
        context
      );

      // Verify response includes user data
      expect(responseData).toEqual({
        success: true,
        sessionId: "session-id-456",
        user: {
          email: "test@example.com",
          name: "Test User",
          picture: "https://example.com/picture.jpg",
        },
      });
    });

    it("should handle user creation failure gracefully", async () => {
      // Mock successful OAuth but failed user creation
      const oauthResponse = {
        status: 200,
        json: async () => ({
          success: true,
          session: {
            userId: "oauth-sub",
            email: "test@example.com",
            provider: "google",
            expiresAt: Date.now() + 3600000,
            state: "test-state",
          },
        }),
      };
      vi.spyOn(oauthHandler, "handleOAuthCallbackWithParams").mockResolvedValue(
        oauthResponse as Response
      );

      mockUserManager.findOrCreateUser.mockRejectedValue(
        new Error("Database error")
      );

      const params = {
        code: "test-code",
        state: "test-state",
        codeVerifier: "test-verifier",
        provider: "google",
      };

      const response = await handleCallbackWithParams(params, env, context);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        success: false,
        error: "server_error",
        error_description: "Failed to create user account",
      });
    });

    it("should update existing user profile if name or picture changed", async () => {
      const existingUser = {
        id: "existing-user-id",
        email: "test@example.com",
        name: "Old Name",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      mockUserManager.findOrCreateUser.mockResolvedValue({
        ...existingUser,
        name: "Updated Name",
        picture: "https://example.com/new-picture.jpg",
        updatedAt: new Date().toISOString(),
      });

      const oauthResponse = {
        status: 200,
        json: async () => ({
          success: true,
          session: {
            userId: "oauth-sub",
            email: "test@example.com",
            name: "Updated Name",
            picture: "https://example.com/new-picture.jpg",
            provider: "google",
            expiresAt: Date.now() + 3600000,
            state: "test-state",
          },
        }),
      };
      vi.spyOn(oauthHandler, "handleOAuthCallbackWithParams").mockResolvedValue(
        oauthResponse as Response
      );

      const params = {
        code: "test-code",
        state: "test-state",
        codeVerifier: "test-verifier",
        provider: "google",
      };

      await handleCallbackWithParams(params, env, context);

      expect(mockUserManager.findOrCreateUser).toHaveBeenCalledWith(
        "test@example.com",
        "google",
        context,
        "Updated Name",
        "https://example.com/new-picture.jpg"
      );

      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "existing-user-id",
          name: "Updated Name",
          picture: "https://example.com/new-picture.jpg",
        }),
        context
      );
    });
  });

  describe("Session Data Structure", () => {
    it("should store both persistent user ID and OAuth sub in session", async () => {
      const oauthResponse = {
        status: 200,
        json: async () => ({
          success: true,
          session: {
            userId: "github-sub-456",
            email: "dev@example.com",
            provider: "github",
            expiresAt: Date.now() + 3600000,
            state: "test-state",
          },
        }),
      };
      vi.spyOn(oauthHandler, "handleOAuthCallbackWithParams").mockResolvedValue(
        oauthResponse as Response
      );

      mockUserManager.findOrCreateUser.mockResolvedValue({
        id: "persistent-user-789",
        email: "dev@example.com",
        createdAt: new Date().toISOString(),
      });

      const params = {
        code: "test-code",
        state: "test-state",
        codeVerifier: "test-verifier",
        provider: "github",
      };

      await handleCallbackWithParams(params, env, context);

      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "persistent-user-789", // Our database user ID
          oauthSub: "github-sub-456", // OAuth provider's sub claim
          email: "dev@example.com",
          provider: "github",
        }),
        context
      );
    });
  });

  describe("Performance", () => {
    it("should complete callback handling with user creation within 50ms", async () => {
      const oauthResponse = {
        status: 200,
        json: async () => ({
          success: true,
          session: {
            userId: "oauth-sub",
            email: "perf@example.com",
            name: "Perf Test",
            provider: "google",
            expiresAt: Date.now() + 3600000,
            state: "test-state",
          },
        }),
      };
      vi.spyOn(oauthHandler, "handleOAuthCallbackWithParams").mockResolvedValue(
        oauthResponse as Response
      );

      mockUserManager.findOrCreateUser.mockResolvedValue({
        id: "perf-user-id",
        email: "perf@example.com",
        name: "Perf Test",
        createdAt: new Date().toISOString(),
      });

      const params = {
        code: "test-code",
        state: "test-state",
        codeVerifier: "test-verifier",
        provider: "google",
      };

      const start = performance.now();
      await handleCallbackWithParams(params, env, context);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});