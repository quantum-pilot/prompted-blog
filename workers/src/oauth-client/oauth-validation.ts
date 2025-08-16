// @agent: cloudflare-backend
/**
 * Validation utilities for OAuth flow
 */

/**
 * Validates that a state parameter is safe to use as a KV key suffix.
 * States should be alphanumeric with hyphens and underscores, max 128 chars.
 */
export function isValidStateParameter(state: string): boolean {
  // Allow alphanumeric, dash, underscore, max 128 chars
  // This prevents injection attacks and ensures safe KV key usage
  const statePattern = /^[A-Za-z0-9_-]{1,128}$/;
  return statePattern.test(state);
}

/**
 * Validates PKCE code verifier against stored challenge
 */
export async function validatePKCE(verifier: string, challenge: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64 === challenge;
}