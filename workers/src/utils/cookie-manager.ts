// Cookie management utilities for Cloudflare Workers
// Handles secure HttpOnly cookies for session management

export const COOKIE_NAME = 'pb_session';
export const MAX_AGE = 1 * 24 * 60 * 60; // 1 day in seconds

interface Env {
  ENVIRONMENT?: string;
}

/**
 * Creates headers with a secure session cookie
 * @param sessionId - The session ID to set (32-128 chars)
 * @param env - Environment configuration
 * @returns Headers object with Set-Cookie header
 */
export function setSessionCookie(sessionId: string, env: Env): Headers {
  const headers = new Headers();
  const isProduction = env.ENVIRONMENT === 'production';
  
  // Build cookie attributes
  const cookieParts = [
    `${COOKIE_NAME}=${sessionId}`,
    'HttpOnly',
    'SameSite=Lax',  // Changed from Strict to Lax to allow OAuth flow
    'Path=/',
    `Max-Age=${MAX_AGE}`
  ];
  
  // Add Secure flag for production
  if (isProduction) {
    cookieParts.push('Secure');
    // Set domain for subdomain support in production
    cookieParts.push('Domain=.promptedblog.com');
  }
  
  headers.set('Set-Cookie', cookieParts.join('; '));
  return headers;
}

/**
 * Extracts session ID from Cookie header
 * @param request - The incoming request
 * @returns Session ID or null if not found
 */
export function getSessionFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  
  if (!cookieHeader) {
    return null;
  }
  
  // Parse cookies: "name1=value1; name2=value2"
  const cookies = cookieHeader.split(';').map(c => c.trim());
  
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name.trim() === COOKIE_NAME && value) {
      return value.trim();
    }
  }
  
  return null;
}

/**
 * Returns headers to delete the session cookie
 * @returns Headers object with Set-Cookie header to clear the cookie
 */
export function clearSessionCookie(): Headers {
  const headers = new Headers();
  
  // Set cookie with empty value and Max-Age=0 to delete it
  const cookieParts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0'
  ];
  
  headers.set('Set-Cookie', cookieParts.join('; '));
  return headers;
}