/**
 * OAuth Session Management
 * Handles in-memory session ID storage and validation for popup mode only
 * No sessionStorage is used for security reasons
 */

import { 
  OAuthSession, 
  SessionValidationResponse
} from '@app/shared';
import { createHonoClient, getAuthHeaders } from './hono-client';

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
  // SECURITY: Never pass session ID in URL parameters
  // Send it in the Authorization header instead
  
  // Create Hono client with the specific worker URL
  const client = createHonoClient(workerUrl);
  
  // Use Hono client with typed headers
  const response = await client.oauth.session.$get(
    {},
    {
      headers: getAuthHeaders(sessionId),
    }
  );
  
  if (!response.ok) {
    // Session invalid or expired
    clearSessionId();
    return null;
  }
  
  const data = (await response.json()) as SessionValidationResponse;
  
  // Check if it's an error response using discriminated union
  if ('error' in data) {
    // This is SessionValidationError
    clearSessionId();
    return null;
  }
  
  // This is SessionValidationSuccess, convert to OAuthSession
  return {
    provider: data.provider,
    email: data.email,
    name: data.name,
    picture: data.picture,
    expiresAt: data.expiresAt
  } as OAuthSession;
}

/**
 * Clear all OAuth session data
 * Clears the in-memory session ID
 */
export function clearOAuthData(): void {
  clearSessionId();
}