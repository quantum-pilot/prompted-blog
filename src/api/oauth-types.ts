/**
 * OAuth Type Definitions
 */

export enum OAuthProvider {
  Google = 'google',
  GitHub = 'github' // Future support
}

export interface OAuthConfig {
  workerUrl: string;
  clientId: string;
  redirectUri: string;
  provider: OAuthProvider;
  scopes?: string[];
}

export interface OAuthSession {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  expiresAt: number;
  codeChallenge?: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  sessionId?: string;
  expiresAt?: number;
  error?: string;
}

export interface ProviderConfig {
  authorizationEndpoint: string;
  scopes: string[];
  additionalParams?: Record<string, string>;
}
