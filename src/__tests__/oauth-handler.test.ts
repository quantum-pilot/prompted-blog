import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create mock functions
const mockStartAuthFlow = vi.fn();
const mockLogout = vi.fn();
const mockCheckAndShowUsernameSetup = vi.fn();
const mockCheckAuthStatus = vi.fn();
const mockRefreshAuth = vi.fn();
const mockGetState = vi.fn();

// Mock the API client module with factory function
vi.mock("../api/oauth-client", () => {
  return {
    OAuthProvider: {
      Google: "google",
      GitHub: "github",
    },
    OAuthClient: vi.fn(() => ({
      startAuthFlow: mockStartAuthFlow,
      logout: mockLogout,
    })),
  };
});

// Mock username setup handler
vi.mock("../username-setup-handler", () => ({
  checkAndShowUsernameSetup: mockCheckAndShowUsernameSetup
}));

// Mock auth state
vi.mock("../auth-state", () => ({
  authState: {
    checkAuthStatus: mockCheckAuthStatus,
    refreshAuth: mockRefreshAuth,
    getState: mockGetState,
  }
}));

// Mock OAUTH_PROVIDERS
vi.mock("@app/shared", () => ({
  OAuthProvider: {
    Google: "google",
    GitHub: "github",
  },
  OAUTH_PROVIDERS: {
    google: {
      clientId: "test-client-id",
    },
  },
}));

describe("OAuth Handler", () => {
  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = "";

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();

    // Reset all mock functions
    mockStartAuthFlow.mockReset();
    mockLogout.mockReset();
    mockCheckAndShowUsernameSetup.mockReset();
    mockCheckAuthStatus.mockReset();
    mockRefreshAuth.mockReset();
    mockGetState.mockReset();

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset modules
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("setupOAuthHandler", () => {
    it("should register oauth-start event listener", async () => {
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");
      
      const module = await import("../oauth-handler");
      module.setupOAuthHandler();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "oauth-start",
        expect.any(Function)
      );
    });

    it("should start OAuth flow when oauth-start event is dispatched", async () => {
      mockStartAuthFlow.mockResolvedValue(undefined);
      mockRefreshAuth.mockResolvedValue(undefined);
      mockGetState.mockReturnValue({
        isAuthenticated: true,
        session: { username: "testuser" },
        user: null,
        isChecking: false,
      });

      const module = await import("../oauth-handler");
      module.setupOAuthHandler();

      const event = new CustomEvent("oauth-start", {
        detail: { provider: "google" },
      });

      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockStartAuthFlow).toHaveBeenCalled();
      // refreshAuth is not called immediately since OAuth now uses redirect flow
      expect(mockRefreshAuth).not.toHaveBeenCalled();
    });

    // Removed test - OAuth now uses redirect flow, username setup happens after redirect

    it("should dispatch oauth-error event on OAuth failure", async () => {
      mockStartAuthFlow.mockRejectedValue(new Error("OAuth failed"));

      const module = await import("../oauth-handler");
      module.setupOAuthHandler();

      const errorListener = vi.fn();
      document.addEventListener("oauth-error", errorListener);

      const event = new CustomEvent("oauth-start", {
        detail: { provider: "google" },
      });

      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            error: "OAuth failed",
          }),
        })
      );
    });

    it("should check existing session on initialization", async () => {
      mockGetState.mockReturnValue({
        isAuthenticated: false,
        session: null,
        user: null,
        isChecking: false,
      });

      const module = await import("../oauth-handler");
      module.setupOAuthHandler();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockCheckAuthStatus).toHaveBeenCalled();
    });

    it("should dispatch oauth-restored event for existing session", async () => {
      const existingUser = { username: "existinguser", email: "existing@example.com" };
      
      mockCheckAuthStatus.mockResolvedValue(undefined);
      mockGetState.mockReturnValue({
        isAuthenticated: true,
        session: existingUser,
        user: existingUser,
        isChecking: false,
      });

      const restoredListener = vi.fn();
      document.addEventListener("oauth-restored", restoredListener);

      const module = await import("../oauth-handler");
      module.setupOAuthHandler();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(restoredListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            user: existingUser,
          }),
        })
      );
    });

    it("should check username setup for existing session with no username", async () => {
      const userWithoutUsername = { email: "test@example.com" };
      
      mockCheckAuthStatus.mockResolvedValue(undefined);
      mockGetState.mockReturnValue({
        isAuthenticated: true,
        session: userWithoutUsername,
        user: userWithoutUsername,
        isChecking: false,
      });

      const module = await import("../oauth-handler");
      module.setupOAuthHandler();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockCheckAndShowUsernameSetup).toHaveBeenCalledWith(userWithoutUsername);
    });

    it("should handle errors in existing session check gracefully", async () => {
      mockCheckAuthStatus.mockRejectedValue(new Error("Session check failed"));

      const module = await import("../oauth-handler");
      module.setupOAuthHandler();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should log error but not throw
      expect(console.error).toHaveBeenCalledWith(
        "Failed to check existing session:",
        expect.any(Error)
      );
    });

    // Removed test - OAuth now uses redirect flow, success event fires after redirect
  });
});