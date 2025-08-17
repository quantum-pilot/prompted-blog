import { OAuthFlowStart } from "./components/oauth-flow-start/index.js";
import { setupOAuthHandler } from "./oauth-handler.js";

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
}

function init(): void {
  enforceHTTPS();
  registerComponents();
  setupOAuthHandler();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { registerComponents };
