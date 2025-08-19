// @agent: cloudflare-backend
/**
 * OAuth callback handler using oauth4webapi for PKCE flow
 */

import * as oauth from "oauth4webapi";
import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { AuditEventType } from "../utils/audit-logger";
import { isValidStateParameter } from "./oauth-validation";
import { exchangeCodeForTokens, validateGoogleIdToken } from "./token-handler";
import { extractUserInfo } from "./user-info-handler";
import { 
  HttpStatus,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  OAuthCallbackSuccess,
  OAuthCallbackError,
  OAuthSession 
} from "../../../shared";
import { validateStoredChallenge, parseRequestParams } from "./pkce-validation";
import { getProvider } from "./oauth-provider";

export type { OAuthProviderConfig } from "./oauth-provider";
export { getProvider } from "./oauth-provider";

// New function that accepts pre-parsed parameters
export async function handleOAuthCallbackWithParams(
  params: { code: string | null; state: string | null; codeVerifier: string | null; provider?: string | null },
  env: Env,
  context: RequestContext
): Promise<Response> {
  const { code, state, codeVerifier } = params;
  if (!code || !state || !codeVerifier) {
    const reason = !code
      ? "Missing authorization code"
      : !state
      ? "Missing state parameter - possible CSRF attack"
      : "Missing PKCE code verifier";
    return context.errorResponse(
      HttpStatus.BAD_REQUEST,
      "invalid_request",
      "Authentication failed",
      env,
      !codeVerifier
        ? AuditEventType.PKCE_VERIFICATION_FAILURE
        : AuditEventType.AUTH_LOGIN_FAILURE,
      { reason }
    );
  }

  if (!isValidStateParameter(state)) {
    return context.errorResponse(
      HttpStatus.BAD_REQUEST,
      "invalid_request",
      "Authentication failed",
      env,
      AuditEventType.AUTH_LOGIN_FAILURE,
      { reason: "Invalid state parameter format" }
    );
  }

  const challengeInfo = await validateStoredChallenge(
    env,
    state,
    codeVerifier,
    context
  );
  if (!challengeInfo) {
    return context.errorResponse(
      HttpStatus.BAD_REQUEST,
      "invalid_grant",
      "Authentication failed",
      env
    );
  }

  if (!challengeInfo.provider) {
    return context.errorResponse(
      HttpStatus.BAD_REQUEST,
      "invalid_request",
      "Authentication failed",
      env,
      AuditEventType.AUTH_LOGIN_FAILURE,
      { reason: "Missing provider in stored challenge" }
    );
  }

  const provider = getProvider(challengeInfo.provider, env);
  try {
    const as = await oauth
      .discoveryRequest(provider.authorizationServer)
      .then((res) =>
        oauth.processDiscoveryResponse(provider.authorizationServer, res)
      );

    const tokens = await exchangeCodeForTokens(
      {
        code,
        codeVerifier,
        clientId: provider.clientId,
        redirectUri: provider.redirectUri,
        tokenEndpoint: as.token_endpoint!,
      },
      as,
      context
    );

    let claims;
    try {
      claims = validateGoogleIdToken(tokens, provider.clientId, context);
    } catch (error) {
      return context.errorResponse(
        HttpStatus.BAD_REQUEST,
        "invalid_grant",
        "Authentication failed",
        env,
        AuditEventType.AUTH_LOGIN_FAILURE,
        { reason: "ID token validation failed", error: error instanceof Error ? error.message : "Unknown error" }
      );
    }

    const sessionData = extractUserInfo(
      claims,
      provider.name,
      state,
      tokens.expires_in
    );
    context.log(AuditEventType.PKCE_FLOW_COMPLETED, "success", {
      provider: provider.name,
      userId: sessionData.userId,
    });

    return context.successResponse(
      { success: true, session: sessionData },
      env
    );
  } catch (error) {
    return context.errorResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "server_error",
      "Authentication failed",
      env,
      AuditEventType.AUTH_LOGIN_FAILURE,
      { reason: "OAuth flow failed", error: error instanceof Error ? error.message : "Unknown error" }
    );
  }
}

// Original function that parses request
export async function handleOAuthCallback(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const params = await parseRequestParams(request, context);
  if (!params) {
    return context.errorResponse(
      HttpStatus.BAD_REQUEST,
      "invalid_request",
      "Authentication failed",
      env
    );
  }

  return handleOAuthCallbackWithParams(params, env, context);
}
