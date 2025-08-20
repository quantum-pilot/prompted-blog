import { OAuthFlowStart } from "./components/oauth-flow-start/index.js";
import { UsernameSetupModal } from "./components/username-setup-modal/index.js";
import { AuthHandler } from "./components/auth-handler/index.js";
import { setupOAuthHandler } from "./oauth-handler.js";
import { cleanupUsernameModal } from "./username-setup-handler.js";

function enforceHTTPS(): void {
  // Only enforce HTTPS in production (not localhost or 127.0.0.1)
  const isLocalhost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]' || // IPv6 localhost
    window.location.hostname.startsWith('192.168.') || // Local network
    window.location.hostname.startsWith('10.'); // Local network
    
  if (!isLocalhost && window.location.protocol !== 'https:') {
    window.location.replace('https:' + window.location.href.substring(window.location.protocol.length));
  }
}

function registerComponents(): void {
  if (!customElements.get("oauth-flow-start")) {
    customElements.define("oauth-flow-start", OAuthFlowStart);
  }
  if (!customElements.get("username-setup-modal")) {
    customElements.define("username-setup-modal", UsernameSetupModal);
  }
  if (!customElements.get("auth-handler")) {
    customElements.define("auth-handler", AuthHandler);
  }
}

function setupEventHandlers(): void {
  // Listen for username ready event
  document.addEventListener("username-ready", (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log("Username setup complete:", customEvent.detail?.username);
    // App can now proceed with username-dependent features
  });

  // Handle username setup errors
  document.addEventListener("username-setup-error", (event: Event) => {
    const customEvent = event as CustomEvent;
    console.error("Username setup error:", customEvent.detail?.error);
    // App should handle this error appropriately
  });

  // Clean up modal on page unload
  window.addEventListener("beforeunload", () => {
    cleanupUsernameModal();
  });
}

function init(): void {
  enforceHTTPS();
  registerComponents();
  setupEventHandlers();
  setupOAuthHandler();
  
  // Add auth-handler component to handle authentication routing
  const authHandler = document.createElement("auth-handler");
  document.body.appendChild(authHandler);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { registerComponents, UsernameSetupModal, AuthHandler };
