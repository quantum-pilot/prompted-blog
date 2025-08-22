import { BaseComponent } from "../../utils/base-component.js";
import { OAuthProvider } from "@app/shared";
import { OAuthClient } from "../../api/oauth-client.js";
import { authState } from "../../auth-state.js";
import { ErrorHandler } from "../../utils/error-handler.js";

export interface OAuthStartEvent extends CustomEvent {
  detail: { provider: OAuthProvider };
}

export class OAuthFlowStart extends BaseComponent {
  private isAuthenticated = false;
  private isLoading = false;
  private oauthClient: OAuthClient;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    const workerUrl = window.location.hostname === 'localhost' ? 'http://localhost:8787' : window.location.origin;
    this.oauthClient = new OAuthClient({
      provider: OAuthProvider.Google,
      clientId: '577515652450-example.apps.googleusercontent.com',
      redirectUri: `${window.location.origin}/oauth/callback`,
      workerUrl
    });
    // Subscribe to auth state changes
    this.unsubscribe = authState.subscribe((state) => {
      this.isAuthenticated = state.isAuthenticated;
      this.isLoading = state.isChecking;
      this.render();
    });
    
    // Initial render with current state
    const state = authState.getState();
    this.isAuthenticated = state.isAuthenticated;
    this.isLoading = state.isChecking;
    this.render();
    
    // Trigger auth check if not already done
    authState.checkAuthStatus();
    
    this.addManagedEventListener(window, "oauth:logout", () => {
      authState.clearAuth();
    });
    
    // Listen for OAuth success to refresh auth state
    this.addManagedEventListener(document, "oauth-success", () => {
      authState.refreshAuth();
    });
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private render(): void {
    while (this.firstChild) this.removeChild(this.firstChild);

    const container = document.createElement('div');
    container.className = 'oauth-buttons';
    const button = document.createElement('button');
    button.type = 'button';
    
    if (this.isAuthenticated) {
      button.className = 'oauth-button oauth-button--logout';
      button.textContent = 'Sign out';
      button.disabled = this.isLoading;
    } else {
      button.dataset.provider = 'google';
      button.className = 'oauth-button oauth-button--google';
      button.textContent = 'Sign in with Google';
    }

    container.appendChild(button);
    this.appendChild(container);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const button = this.querySelector('button') as HTMLButtonElement;
    if (!button) return;
    
    const handler = this.isAuthenticated
      ? () => this.handleLogout()
      : () => this.handleLogin(OAuthProvider.Google);
    this.addManagedEventListener(button, "click", handler);
  }

  private handleLogin(provider: OAuthProvider): void {
    this.dispatchEvent(new CustomEvent("oauth-start", {
      detail: { provider },
      bubbles: true,
      cancelable: true,
    }));
  }

  private async handleLogout(): Promise<void> {
    this.isLoading = true;
    this.render();
    
    await ErrorHandler.getInstance().wrap(
      () => this.oauthClient.logout(),
      { message: "Failed to logout" }
    );
    
    this.isLoading = false;
    this.isAuthenticated = false;
    this.render();
  }

}