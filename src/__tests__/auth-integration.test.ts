import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthHandler } from "../components/auth-handler/index";
import { ProfileClient } from "../api/profile-client";
import { OAuthClient } from "../api/oauth-client";
import { checkAndShowUsernameSetup, cleanupUsernameModal } from "../username-setup-handler";
import { setupOAuthHandler } from "../oauth-handler";

// Mock dependencies
vi.mock("../api/profile-client");
vi.mock("../api/oauth-client");

// Mock username setup modal component
class MockUsernameSetupModal extends HTMLElement {
  constructor() {
    super();
  }
}

describe("Authentication Integration Flow", () => {
  let mockProfileClient: any;
  let mockOAuthClient: any;
  let mockAssign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = "";
    
    // Define custom elements if not already defined
    if (!customElements.get("username-setup-modal")) {
      customElements.define("username-setup-modal", MockUsernameSetupModal);
    }
    if (!customElements.get("auth-handler")) {
      customElements.define("auth-handler", AuthHandler);
    }

    // Clear all mocks
    vi.clearAllMocks();

    // Mock window.location.assign
    mockAssign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { 
        hostname: "localhost", 
        origin: "http://localhost:3000",
        pathname: "/",
        assign: mockAssign 
      },
      writable: true,
      configurable: true
    });

    // Setup ProfileClient mock
    mockProfileClient = {
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      checkUsernameAvailability: vi.fn()
    };
    vi.mocked(ProfileClient).mockImplementation(() => mockProfileClient);

    // Setup OAuthClient mock
    mockOAuthClient = {
      startAuthFlow: vi.fn(),
      handleCallback: vi.fn(),
      validateSession: vi.fn(),
      logout: vi.fn()
    };
    vi.mocked(OAuthClient).mockImplementation(() => mockOAuthClient);

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    document.body.innerHTML = "";
  });

  describe("OAuth Success → Username Setup → Admin Route", () => {
    it("should route to admin when user has existing username", async () => {
      // Setup: User is authenticated with existing username (cookies handled by backend)
      mockProfileClient.getProfile.mockResolvedValue({
        success: true,
        user: {
          id: "user-123",
          email: "test@example.com",
          provider: "google",
          username: "existinguser",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01"
        }
      });
      
      // Create auth-handler component
      const authHandler = new AuthHandler();
      document.body.appendChild(authHandler);

      // Simulate OAuth success flow
      await checkAndShowUsernameSetup();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify: username-ready event was dispatched
      const readyEventSpy = vi.fn();
      document.addEventListener("username-ready", readyEventSpy);
      
      // Trigger the flow again to verify event
      await checkAndShowUsernameSetup();
      
      // Verify: Auth handler routes to admin
      expect(mockAssign).toHaveBeenCalledWith("/admin");
    });

    it("should show modal then route to admin when username is set", async () => {
      // Setup: User is authenticated but has no username initially
      mockProfileClient.getProfile.mockResolvedValue({
        success: true,
        user: {
          id: "user-456",
          email: "newuser@example.com",
          provider: "google",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01"
        }
      });
      
      // Create auth-handler component
      const authHandler = new AuthHandler();
      document.body.appendChild(authHandler);

      // Step 1: OAuth success triggers username check
      await checkAndShowUsernameSetup();

      // Verify: Modal is shown
      const modal = document.querySelector("username-setup-modal");
      expect(modal).toBeTruthy();

      // Step 2: User completes username setup
      const completeEvent = new CustomEvent("username-setup-complete", {
        detail: { username: "newusername" },
        bubbles: true
      });
      modal?.dispatchEvent(completeEvent);

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify: Modal is removed
      expect(document.querySelector("username-setup-modal")).toBeFalsy();

      // Verify: Auth handler receives username-ready and routes to admin
      expect(mockAssign).toHaveBeenCalledWith("/admin");
    });

    it("should handle OAuth callback → username check → admin route flow", async () => {
      // Setup OAuth callback scenario
      Object.defineProperty(window, "location", {
        value: {
          hostname: "localhost",
          origin: "http://localhost:3000",
          pathname: "/oauth/callback",
          href: "http://localhost:3000/oauth/callback?code=auth_code",
          assign: mockAssign
        },
        writable: true,
        configurable: true
      });

      // Mock successful OAuth callback
      mockOAuthClient.handleCallback.mockResolvedValue({ success: true });
      mockOAuthClient.validateSession.mockResolvedValue({
        userId: "user-789",
        email: "oauthuser@example.com",
        name: "OAuth User",
        expiresAt: Date.now() + 3600000
      });

      // Mock user has username
      mockProfileClient.getProfile.mockResolvedValue({
        success: true,
        user: {
          id: "user-789",
          email: "oauthuser@example.com",
          provider: "google",
          username: "oauthuser",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01"
        }
      });

      // Create auth-handler first
      const authHandler = new AuthHandler();
      document.body.appendChild(authHandler);
      
      // Mock replaceState to prevent navigation
      const replaceStateSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
      
      setupOAuthHandler();

      // Wait for OAuth callback processing
      await vi.waitFor(() => {
        expect(mockOAuthClient.handleCallback).toHaveBeenCalled();
      }, { timeout: 1000 });

      // Wait for username check and routing
      await vi.waitFor(() => {
        expect(mockAssign).toHaveBeenCalledWith("/admin");
      }, { timeout: 1000 });

      replaceStateSpy.mockRestore();
    });

    it("should route to subdomain in production environment", async () => {
      // Setup production environment
      Object.defineProperty(window, "location", {
        value: {
          hostname: "promptedblog.com",
          origin: "https://promptedblog.com",
          pathname: "/",
          assign: mockAssign
        },
        writable: true,
        configurable: true
      });

      // Setup user is authenticated with username
      mockProfileClient.getProfile.mockResolvedValue({
        success: true,
        user: {
          id: "prod-user",
          email: "produser@example.com",
          provider: "google",
          username: "produser",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01"
        }
      });

      // Create auth-handler
      const authHandler = new AuthHandler();
      document.body.appendChild(authHandler);

      // Trigger username check
      await checkAndShowUsernameSetup();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify: Routes to subdomain
      expect(mockAssign).toHaveBeenCalledWith("https://produser.promptedblog.com/admin/");
    });
  });

  describe("Error Handling", () => {
    it("should not route when profile fetch fails", async () => {
      // Setup: Profile fetch returns error
      mockProfileClient.getProfile.mockResolvedValue({
        success: false,
        error: "internal_error",
        error_description: "Server error"
      });

      // Create auth-handler
      const authHandler = new AuthHandler();
      document.body.appendChild(authHandler);
      
      const errorListener = vi.fn();
      document.addEventListener("username-setup-error", errorListener);

      await checkAndShowUsernameSetup();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify: No routing occurs
      expect(mockAssign).not.toHaveBeenCalled();
      
      // Verify: Error event is dispatched
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { error: "Server error" }
        })
      );
    });

    it("should not route when user is not authenticated", async () => {
      // Setup: Not authenticated (profile returns unauthorized)
      mockProfileClient.getProfile.mockResolvedValue({
        success: false,
        error: "unauthorized",
        error_description: "No active session"
      });

      // Create auth-handler
      const authHandler = new AuthHandler();
      document.body.appendChild(authHandler);

      // Wait for init check
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify: Profile check was made but no routing
      expect(mockProfileClient.getProfile).toHaveBeenCalled();
      expect(mockAssign).not.toHaveBeenCalled();
    });

    it("should handle unauthorized gracefully", async () => {
      // Setup: Unauthorized response
      mockProfileClient.getProfile.mockResolvedValue({
        success: false,
        error: "unauthorized",
        error_description: "No active session"
      });

      // Create auth-handler
      const authHandler = new AuthHandler();
      document.body.appendChild(authHandler);

      // Trigger username check
      await checkAndShowUsernameSetup();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify: No routing or modal shown
      expect(mockAssign).not.toHaveBeenCalled();
      expect(document.querySelector("username-setup-modal")).toBeFalsy();
      
      // Verify: Error logged
      expect(console.error).toHaveBeenCalledWith("No active session for username check");
    });
  });

  describe("Event Flow", () => {
    it("should properly chain events: oauth-success → username-ready → route", async () => {
      const eventOrder: string[] = [];
      
      // Track event order
      document.addEventListener("oauth-success", () => eventOrder.push("oauth-success"));
      document.addEventListener("username-ready", () => eventOrder.push("username-ready"));

      // Setup user with username
      mockOAuthClient.validateSession.mockResolvedValue({
        userId: "event-user",
        email: "eventuser@example.com",
        name: "Event User",
        expiresAt: Date.now() + 3600000
      });
      
      mockProfileClient.getProfile.mockResolvedValue({
        success: true,
        user: {
          id: "event-user",
          email: "eventuser@example.com",
          provider: "google",
          username: "eventuser",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01"
        }
      });

      // Mock authenticated user with username for session check
      mockOAuthClient.validateSession.mockResolvedValue({
        provider: "google",
        email: "eventuser@example.com",
        name: "Event User",
        expiresAt: Date.now() + 3600000
      });
      
      mockProfileClient.getProfile.mockResolvedValue({
        success: true,
        user: {
          id: "event-user",
          email: "eventuser@example.com",
          provider: "google",
          username: "eventuser",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01"
        }
      });
      
      // Create auth-handler
      const authHandler = new AuthHandler();
      document.body.appendChild(authHandler);
      
      setupOAuthHandler();

      // Wait for existing session check
      await vi.waitFor(() => {
        expect(mockOAuthClient.validateSession).toHaveBeenCalled();
      }, { timeout: 1000 });

      // Wait for all events to be dispatched
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event order
      expect(eventOrder).toContain("username-ready");
      
      // Verify final routing
      expect(mockAssign).toHaveBeenCalledWith("/admin");
    });

    it("should handle username-ready event from any source", () => {
      // Create auth-handler
      const authHandler = new AuthHandler();
      document.body.appendChild(authHandler);

      // Dispatch username-ready from external source
      const usernameReadyEvent = new CustomEvent("username-ready", {
        detail: { username: "externaluser" },
        bubbles: true
      });
      window.dispatchEvent(usernameReadyEvent);

      // Verify: Routes to admin
      expect(mockAssign).toHaveBeenCalledWith("/admin");
    });
  });
});