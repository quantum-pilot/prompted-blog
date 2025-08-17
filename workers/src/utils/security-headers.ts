// @agent: cloudflare-backend
/**
 * Security headers utility for Cloudflare Workers
 * Provides defense-in-depth security headers for all responses
 */

export function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent clickjacking
    "X-Frame-Options": "DENY",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Enable XSS protection (for older browsers)
    "X-XSS-Protection": "1; mode=block",

    // Referrer policy for privacy
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Enhanced Content Security Policy
    "Content-Security-Policy": "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",

    // HSTS (if using HTTPS)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",

    // Permissions Policy (replace Feature-Policy)
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };
}

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  const securityHeaders = getSecurityHeaders();

  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
