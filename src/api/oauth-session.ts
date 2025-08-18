/**
 * OAuth Session Management
 * Handles in-memory session ID storage and validation for popup mode only
 * No sessionStorage is used for security reasons
 */

import { OAuthSession } from '@app/shared';

// In-memory storage for session ID (popup mode only)
let currentSessionId: string | null = null;

/**
 * Store session ID in memory
 */
export function storeSessionId(sessionId: string): void {
  currentSessionId = sessionId;
}

/**
 * Get session ID from memory
 */
export function getSessionId(): string | null {
  return currentSessionId;
}

/**
 * Clear session ID from memory
 */
export function clearSessionId(): void {
  currentSessionId = null;
}

/**
 * Validate session with worker
 */
export async function validateSessionWithWorker(
  workerUrl: string,
  sessionId: string
): Promise<OAuthSession | null> {
  const url = new URL('/oauth/session', workerUrl);
  // SECURITY: Never pass session ID in URL parameters
  // Send it in the Authorization header instead
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${sessionId}`
    }
  });
  
  if (!response.ok) {
    // Session invalid or expired
    clearSessionId();
    return null;
  }
  
  return response.json() as Promise<OAuthSession>;
}

/**
 * Clear all OAuth session data
 * Clears the in-memory session ID
 */
export function clearOAuthData(): void {
  clearSessionId();
}