/**
 * OAuth Session Management
 * Handles cookie-based session validation
 * Session cookies are now managed by the backend via HttpOnly cookies
 */

import { 
  OAuthSession, 
  SessionValidationResponse
} from '@app/shared';
import { createHonoClient } from './hono-client';

/**
 * Validate session with worker using cookies
 * No sessionId parameter needed - cookies are sent automatically
 */
export async function validateSessionWithWorker(
  workerUrl: string
): Promise<OAuthSession | null> {
  // Create Hono client with the specific worker URL
  const client = createHonoClient(workerUrl);
  
  // Use Hono client - cookies are sent automatically with credentials: 'include'
  const response = await client.oauth.session.$get(
    {},
    {}
  );
  
  if (!response.ok) {
    // Session invalid or expired
    return null;
  }
  
  const data = (await response.json()) as SessionValidationResponse;
  
  // Check if it's an error response using discriminated union
  if ('error' in data) {
    // This is SessionValidationError
    return null;
  }
  
  // This is SessionValidationSuccess, convert to OAuthSession
  return {
    provider: data.provider,
    email: data.email,
    name: data.name,
    picture: data.picture,
    expiresAt: data.expiresAt,
    username: data.username // Include username from session
  } as OAuthSession;
}