/**
 * Centralized authentication state management
 * Single source of truth for auth status to prevent redundant API calls
 */
import { OAuthClient } from "./api/oauth-client";
import { ProfileClient } from "./api/profile-client";
import type { OAuthSession } from "@app/shared";
import type { UserAccount } from "@app/shared/contracts";
import { OAuthProvider, OAUTH_PROVIDERS } from "@app/shared";

export interface AuthState {
  isAuthenticated: boolean;
  isChecking: boolean;
  session: OAuthSession | null;
  user: UserAccount | null;
}

class AuthStateManager {
  private static instance: AuthStateManager;
  private state: AuthState = {
    isAuthenticated: false,
    isChecking: false,
    session: null,
    user: null,
  };
  private checkPromise: Promise<void> | null = null;
  private listeners: Set<(state: AuthState) => void> = new Set();
  private oauthClient: OAuthClient;
  private profileClient: ProfileClient;

  private constructor() {
    this.oauthClient = new OAuthClient({
      workerUrl: window.location.origin,
      clientId: OAUTH_PROVIDERS.google.clientId,
      redirectUri: `${window.location.origin}/oauth-callback`,
      provider: OAuthProvider.Google,
    });
    this.profileClient = new ProfileClient();
  }

  static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager();
    }
    return AuthStateManager.instance;
  }

  /**
   * Check authentication status - returns cached promise if already checking
   */
  async checkAuthStatus(): Promise<void> {
    // If already checking, return the existing promise
    if (this.checkPromise) {
      return this.checkPromise;
    }

    // If already checked and not authenticated, skip
    if (!this.state.isChecking && !this.state.isAuthenticated) {
      // Only skip if we've already checked once (not initial state)
      if (this.state.session === null && this.checkPromise !== null) {
        return;
      }
    }

    // Start checking
    this.checkPromise = this.performAuthCheck();
    return this.checkPromise;
  }

  private async performAuthCheck(): Promise<void> {
    this.updateState({ isChecking: true });

    try {
      // First check session (includes username now)
      const session = await this.oauthClient.validateSession();
      
      if (session) {
        // If we have username in session, we're done
        if (session.username) {
          this.updateState({
            isAuthenticated: true,
            isChecking: false,
            session,
            user: {
              id: (session as any).userId || '',
              email: session.email,
              username: session.username,
              provider: session.provider,
              createdAt: 0,
              updatedAt: 0,
            } as UserAccount,
          });
        } else {
          // Need to fetch full profile for username
          const profileResponse = await this.profileClient.getProfile();
          if (profileResponse.success) {
            this.updateState({
              isAuthenticated: true,
              isChecking: false,
              session,
              user: profileResponse.user,
            });
          } else {
            // Session valid but can't get profile - partial state
            this.updateState({
              isAuthenticated: true,
              isChecking: false,
              session,
              user: null,
            });
          }
        }
      } else {
        // Not authenticated
        this.updateState({
          isAuthenticated: false,
          isChecking: false,
          session: null,
          user: null,
        });
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      this.updateState({
        isAuthenticated: false,
        isChecking: false,
        session: null,
        user: null,
      });
    } finally {
      // Clear the promise so future calls will check again if needed
      setTimeout(() => {
        this.checkPromise = null;
      }, 100);
    }
  }

  /**
   * Get current auth state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<AuthState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  /**
   * Clear auth state (for logout)
   */
  clearAuth(): void {
    this.updateState({
      isAuthenticated: false,
      isChecking: false,
      session: null,
      user: null,
    });
    this.checkPromise = null;
  }

  /**
   * Force refresh auth state
   */
  async refreshAuth(): Promise<void> {
    this.checkPromise = null;
    return this.checkAuthStatus();
  }
}

export const authState = AuthStateManager.getInstance();