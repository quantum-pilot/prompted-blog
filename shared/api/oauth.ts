/**
 * OAuth API Endpoints and Configurations
 * Centralized OAuth endpoint definitions and URL builders
 */

import type {
  OAuthAuthorizeRequest,
  OAuthCallbackRequest,
} from "../contracts";

/** OAuth API endpoint paths */
export const OAUTH_ENDPOINTS = {
  authorize: "/oauth/authorize",
  callback: "/oauth/callback",
  session: "/oauth/session",
} as const;

// OAuthProvider is imported from contracts

/**
 * Build OAuth authorization endpoint URL with query parameters
 */
export function buildAuthorizeUrl(
  baseUrl: string,
  params: OAuthAuthorizeRequest
): string {
  const url = new URL(OAUTH_ENDPOINTS.authorize, baseUrl);
  url.searchParams.set("code_challenge", params.code_challenge);
  url.searchParams.set("state", params.state);
  url.searchParams.set("provider", params.provider);
  return url.toString();
}

/**
 * Build OAuth callback endpoint URL
 */
export function buildCallbackUrl(baseUrl: string): string {
  return new URL(OAUTH_ENDPOINTS.callback, baseUrl).toString();
}

/**
 * Build OAuth session endpoint URL
 */
export function buildSessionUrl(baseUrl: string): string {
  return new URL(OAUTH_ENDPOINTS.session, baseUrl).toString();
}

/**
 * Build OAuth provider authorization URL with all required parameters
 * This builds the external provider's authorization URL (Google, GitHub, etc.)
 */
export function buildProviderAuthUrl(
  authorizationUrl: string,
  params: Record<string, string>
): string {
  const url = new URL(authorizationUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

/**
 * Parse OAuth callback parameters from URL
 */
export function parseCallbackParams(url: URL): {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
} {
  return {
    code: url.searchParams.get("code") || undefined,
    state: url.searchParams.get("state") || undefined,
    error: url.searchParams.get("error") || undefined,
    error_description: url.searchParams.get("error_description") || undefined,
  };
}

/**
 * Validate OAuth callback request body
 */
export function validateCallbackRequest(
  body: unknown
): body is OAuthCallbackRequest {
  if (!body || typeof body !== "object") return false;

  const req = body as Record<string, unknown>;
  return (
    typeof req.code === "string" &&
    typeof req.state === "string" &&
    typeof req.code_verifier === "string" &&
    (req.provider === "google" || req.provider === "github")
  );
}
