/**
 * Backward compatibility layer
 * Provides legacy type definitions for existing code
 * New code should import directly from './types/index' or './api/index'
 */

// Note: New types are already exported from shared/index.ts via './types/index'
// This file only provides legacy naming and interfaces for backward compatibility

// Legacy OAuth Provider enum for backward compatibility
// New code should use the string literal type from './api/oauth'
export enum OAuthProvider {
  Google = "google",
  GitHub = "github",
}

// Legacy OAuth Callback Result (maps to discriminated union)
// New code should use OAuthCallbackResponse from './types/oauth'
export interface OAuthCallbackResult {
  success: boolean;
  error?: string;
  sessionId?: string;
}
