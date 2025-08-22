// @agent: cloudflare-backend
/**
 * Token exchange and validation logic for OAuth
 */

import * as oauth from "oauth4webapi";
import type { RequestContext } from "../utils/request-context";
import { AuditEventType } from "../utils/audit-logger";

export interface TokenExchangeParams {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  tokenEndpoint: string;
  clientSecret?: string;
}

export interface TokenValidationResult {
  tokens: oauth.TokenEndpointResponse;
  claims: oauth.IDToken;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  params: TokenExchangeParams,
  as: oauth.AuthorizationServer,
  context: RequestContext
): Promise<oauth.TokenEndpointResponse> {
  // Create OAuth client - use client_secret_post if secret is provided
  const client: oauth.Client = {
    client_id: params.clientId,
    token_endpoint_auth_method: params.clientSecret ? "client_secret_post" : "none",
  };

  // Create URLSearchParams from the authorization response
  // This simulates what validateAuthResponse would return
  const callbackParams = new URLSearchParams();
  callbackParams.set("code", params.code);
  
  // Validate the authorization response (even though we already have the code)
  // This is required by oauth4webapi to ensure the URLSearchParams come from validation
  const currentLocation = new URL(params.redirectUri);
  currentLocation.searchParams.set("code", params.code);
  
  // Validate the simulated response to get properly formatted parameters
  const validatedParams = oauth.validateAuthResponse(
    as,
    client,
    currentLocation,
    oauth.expectNoState // We handle state validation separately
  );

  // Choose authentication method based on whether client_secret is provided
  // Google requires client_secret even with PKCE, while other providers may not
  const clientAuth = params.clientSecret 
    ? oauth.ClientSecretPost(params.clientSecret)
    : oauth.None();

  // Use oauth4webapi's built-in method for token exchange
  try {
    const response = await oauth.authorizationCodeGrantRequest(
      as,
      client,
      clientAuth,
      validatedParams,
      params.redirectUri,
      params.codeVerifier
    );

    // Process the response to get tokens
    const tokens = await oauth.processAuthorizationCodeResponse(
      as,
      client,
      response
    );

    return tokens;
  } catch (error) {
    let errorDetails = error instanceof Error ? error.message : "Unknown error";
    let oauthError = null;
    
    // Extract actual OAuth error from ResponseBodyError
    // oauth4webapi throws ResponseBodyError with the OAuth error in the cause property
    if (error && typeof error === 'object' && 'cause' in error && error.cause) {
      const cause = error.cause as any;
      if (cause.error) {
        oauthError = cause.error;
        errorDetails = `${cause.error}: ${cause.error_description || 'No description provided'}`;
      }
    }
    
    // Log detailed error for debugging
    context.log(AuditEventType.AUTH_LOGIN_FAILURE, "failure", {
      reason: "Token response validation failed",
      error: errorDetails,
      oauthError: oauthError
    });
    throw error;
  }
}

/**
 * Validate ID token claims for Google OAuth
 */
export function validateGoogleIdToken(
  tokens: oauth.TokenEndpointResponse,
  clientId: string,
  context: RequestContext
): oauth.IDToken {
  // Get validated ID token claims (oauth4webapi performed signature verification)
  const claims = oauth.getValidatedIdTokenClaims(tokens);

  if (!claims) {
    throw new Error("No ID token claims available");
  }

  // Additional validation for Google-specific requirements
  const issuer = claims.iss;
  if (
    issuer !== "https://accounts.google.com" &&
    issuer !== "accounts.google.com"
  ) {
    throw new Error("Invalid issuer");
  }

  // Verify audience matches our client ID
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(clientId)) {
    throw new Error("Invalid audience");
  }

  // Check token expiration (oauth4webapi already validates this, but double-check)
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) {
    throw new Error("Token expired");
  }

  // Check issued at time (iat) is not in the future
  if (claims.iat && claims.iat > now + 60) {
    // Allow 60 seconds clock skew
    throw new Error("Token issued in the future");
  }

  return claims;
}
