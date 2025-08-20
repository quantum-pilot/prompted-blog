/**
 * Username Setup Handler - Manages username setup flow after OAuth
 * Checks if user has username and shows modal if needed
 */
import { ProfileClient } from "./api/profile-client";
import type { GetUserResponse } from "@app/shared/contracts";

/** Check if username setup is needed and show modal */
export async function checkAndShowUsernameSetup(): Promise<void> {
  try {
    // Create client instance when needed for better testability
    const profileClient = new ProfileClient();
    
    // Fetch user profile
    const profileResponse = await profileClient.getProfile();
    
    if (!profileResponse.success) {
      // Handle different error cases
      if (profileResponse.error === 'unauthorized') {
        console.error("No active session for username check");
        return;
      }
      throw new Error(profileResponse.error_description);
    }

    // Check if user already has username
    if (profileResponse.user.username) {
      // User has username, dispatch complete event
      dispatchUsernameReady(profileResponse.user.username);
      return;
    }

    // User needs to set username - show modal
    showUsernameSetupModal();
  } catch (error) {
    console.error("Failed to check username setup:", error);
    // Dispatch error event for app to handle
    const errorEvent = new CustomEvent("username-setup-error", {
      detail: { 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      bubbles: true
    });
    document.dispatchEvent(errorEvent);
  }
}

/** Show the username setup modal */
function showUsernameSetupModal(): void {
  // Check if modal already exists
  if (document.querySelector("username-setup-modal")) {
    return;
  }

  // Create and append modal
  const modal = document.createElement("username-setup-modal");
  document.body.appendChild(modal);

  // Listen for completion
  modal.addEventListener("username-setup-complete", handleUsernameSetupComplete);
}

/** Handle username setup completion */
function handleUsernameSetupComplete(event: Event): void {
  const customEvent = event as CustomEvent;
  const username = customEvent.detail?.username;
  
  // Remove modal
  const modal = event.target as HTMLElement;
  modal.remove();

  // Dispatch ready event
  if (username) {
    dispatchUsernameReady(username);
  }
}

/** Dispatch username ready event */
function dispatchUsernameReady(username: string): void {
  const readyEvent = new CustomEvent("username-ready", {
    detail: { username },
    bubbles: true
  });
  document.dispatchEvent(readyEvent);
}

/** Clean up any existing modal */
export function cleanupUsernameModal(): void {
  const modal = document.querySelector("username-setup-modal");
  if (modal) {
    modal.remove();
  }
}