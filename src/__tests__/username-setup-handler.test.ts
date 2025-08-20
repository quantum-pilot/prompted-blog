import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ProfileClient before importing any modules
vi.mock("../api/profile-client", () => {
  return {
    ProfileClient: vi.fn().mockImplementation(() => {
      return {
        getProfile: vi.fn(),
        updateProfile: vi.fn(),
        checkUsernameAvailability: vi.fn()
      };
    })
  };
});

// Import after mocking
import { checkAndShowUsernameSetup, cleanupUsernameModal } from "../username-setup-handler";
import { ProfileClient } from "../api/profile-client";

// Mock UsernameSetupModal component
class MockUsernameSetupModal extends HTMLElement {
  constructor() {
    super();
  }
}

// Only define if not already defined
if (!customElements.get("username-setup-modal")) {
  customElements.define("username-setup-modal", MockUsernameSetupModal);
}

describe("Username Setup Handler", () => {
  let mockProfileClient: any;
  
  beforeEach(() => {
    document.body.innerHTML = "";
    
    // Create a fresh mock instance
    mockProfileClient = {
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      checkUsernameAvailability: vi.fn()
    };
    
    // Mock the ProfileClient constructor to return our mock
    vi.mocked(ProfileClient).mockImplementation(() => mockProfileClient);
    
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanupUsernameModal();
  });

  describe("checkAndShowUsernameSetup", () => {
    it("should show modal when user has no username", async () => {
      mockProfileClient.getProfile.mockResolvedValueOnce({
        success: true,
        user: {
          id: "123",
          email: "test@example.com",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });

      await checkAndShowUsernameSetup();

      const modal = document.querySelector("username-setup-modal");
      expect(modal).toBeTruthy();
    });

    it("should not show modal when user has username", async () => {
      mockProfileClient.getProfile.mockResolvedValueOnce({
        success: true,
        user: {
          id: "123",
          email: "test@example.com",
          provider: "google",
          username: "existing-user",
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });

      const readyListener = vi.fn();
      document.addEventListener("username-ready", readyListener);

      await checkAndShowUsernameSetup();

      const modal = document.querySelector("username-setup-modal");
      expect(modal).toBeFalsy();
      expect(readyListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { username: "existing-user" }
        })
      );
    });

    it("should handle unauthorized error gracefully", async () => {
      mockProfileClient.getProfile.mockResolvedValueOnce({
        success: false,
        error: "unauthorized",
        error_description: "No active session"
      });

      await checkAndShowUsernameSetup();

      const modal = document.querySelector("username-setup-modal");
      expect(modal).toBeFalsy();
      expect(console.error).toHaveBeenCalledWith("No active session for username check");
    });

    it("should dispatch error event on profile fetch failure", async () => {
      mockProfileClient.getProfile.mockResolvedValueOnce({
        success: false,
        error: "internal_error",
        error_description: "Server error"
      });

      const errorListener = vi.fn();
      document.addEventListener("username-setup-error", errorListener);

      await checkAndShowUsernameSetup();

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { error: "Server error" }
        })
      );
    });

    it("should handle network errors", async () => {
      mockProfileClient.getProfile.mockRejectedValueOnce(new Error("Network failed"));

      const errorListener = vi.fn();
      document.addEventListener("username-setup-error", errorListener);

      await checkAndShowUsernameSetup();

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { error: "Network failed" }
        })
      );
    });

    it("should not create duplicate modals", async () => {
      mockProfileClient.getProfile.mockResolvedValue({
        success: true,
        user: {
          id: "123",
          email: "test@example.com",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });

      await checkAndShowUsernameSetup();
      await checkAndShowUsernameSetup();

      const modals = document.querySelectorAll("username-setup-modal");
      expect(modals.length).toBe(1);
    });
  });

  describe("modal completion handling", () => {
    it("should remove modal and dispatch event on completion", async () => {
      mockProfileClient.getProfile.mockResolvedValueOnce({
        success: true,
        user: {
          id: "123",
          email: "test@example.com",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });

      const readyListener = vi.fn();
      document.addEventListener("username-ready", readyListener);

      await checkAndShowUsernameSetup();

      const modal = document.querySelector("username-setup-modal");
      expect(modal).toBeTruthy();

      // Simulate completion event
      const completeEvent = new CustomEvent("username-setup-complete", {
        detail: { username: "new-username" },
        bubbles: true
      });
      modal?.dispatchEvent(completeEvent);

      // Modal should be removed
      expect(document.querySelector("username-setup-modal")).toBeFalsy();

      // Ready event should be dispatched
      expect(readyListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { username: "new-username" }
        })
      );
    });
  });

  describe("cleanupUsernameModal", () => {
    it("should remove existing modal", async () => {
      mockProfileClient.getProfile.mockResolvedValueOnce({
        success: true,
        user: {
          id: "123",
          email: "test@example.com",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });

      await checkAndShowUsernameSetup();
      expect(document.querySelector("username-setup-modal")).toBeTruthy();

      cleanupUsernameModal();
      expect(document.querySelector("username-setup-modal")).toBeFalsy();
    });

    it("should handle no modal gracefully", () => {
      expect(() => cleanupUsernameModal()).not.toThrow();
    });
  });
});