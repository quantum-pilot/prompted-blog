// @agent: cloudflare-backend
/**
 * Security headers utility for Cloudflare Workers
 * Provides defense-in-depth security headers for all responses
 */

import { buildSecurityHeaders } from "../../../shared";

export function getSecurityHeaders(): Record<string, string> {
  // Use shared security header builder with custom CSP
  const baseHeaders = buildSecurityHeaders({
    csp: "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
    frameOptions: "DENY"
  });
  
  // Add additional headers specific to this service
  return {
    ...baseHeaders,
    "Referrer-Policy": "strict-origin-when-cross-origin",
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
