// @agent: cloudflare-backend
/**
 * Validation utilities for session management
 */

/**
 * Validates that a session ID matches the expected format.
 * Session IDs are base64url encoded, 43-44 chars long.
 */
export function isValidSessionId(sessionId: string): boolean {
  const sessionIdPattern = /^[A-Za-z0-9_-]{43,44}$/;
  return sessionIdPattern.test(sessionId);
}

/**
 * Validates that a state parameter is safe to use as a KV key suffix.
 * States should be alphanumeric with hyphens and underscores, max 128 chars.
 */
export function isValidStateParameter(state: string): boolean {
  const statePattern = /^[A-Za-z0-9_-]{1,128}$/;
  return statePattern.test(state);
}