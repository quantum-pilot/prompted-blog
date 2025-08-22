// @agent: cloudflare-backend
/**
 * OAuth authorization initiation handler
 */

import {
  HttpStatus,
  OAuthAuthorizeRequest,
  OAuthAuthorizeResponse,
  OAuthAuthorizeSuccess,
  OAuthAuthorizeError,
  PKCEChallengeData,
  buildProviderAuthUrl,
} from "../../../shared";
import { RequestContext } from "../utils/request-context";
import { AuditEventType } from "../utils/audit-logger";
import { AuditedKVStore } from "../utils/audit-kvstore";
import { getProvider } from "./oauth-provider";
import type { Env } from "./types";
import { isValidStateParameter } from "./session-validation";

function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  return crypto.subtle.digest("SHA-256", data).then((buffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
  );
}

export async function handleInitiateOAuth(
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = context.url;
  const codeChallenge = url.searchParams.get("code_challenge");
  const state = url.searchParams.get("state");
  const provider = url.searchParams.get("provider") as
    | "google"
    | "github"
    | null;

  if (
    !codeChallenge ||
    !state ||
    !provider ||
    (provider !== "google" && provider !== "github") ||
    !isValidStateParameter(state)
  ) {
    const errorResponse: OAuthAuthorizeError = {
      success: false,
      error: "invalid_request",
      error_description: "Missing or invalid parameters",
    };

    context.log(AuditEventType.PKCE_CHALLENGE_STORE_FAILURE, "failure", {
      reason: "Missing or invalid parameters",
    });

    return new Response(JSON.stringify(errorResponse), {
      status: HttpStatus.BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create typed request object
  const request: OAuthAuthorizeRequest = {
    code_challenge: codeChallenge,
    state,
    provider,
  };

  // Store the PKCE challenge with a 10-minute expiration
  const challengeData: PKCEChallengeData = {
    challenge: codeChallenge,
    state,
    provider,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  };

  const auditedKV = new AuditedKVStore(env.OAUTH_SESSIONS);
  await auditedKV.put(
    `pkce:${state}`,
    JSON.stringify(challengeData),
    context.userId || "anonymous",
    { expirationTtl: 600 } // 10 minutes
  );

  context.log(AuditEventType.PKCE_CHALLENGE_STORED, "success", {
    state,
    provider,
  });

  // Get provider configuration with dynamic redirect URI based on request host
  const providerConfig = getProvider(provider, env, context);

  // Build authorization URL using shared utility
  const authParams = {
    client_id: providerConfig.clientId,
    redirect_uri: providerConfig.redirectUri,
    response_type: "code",
    scope: providerConfig.scopes.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    prompt: "consent",
  };

  const authorizationUrl = buildProviderAuthUrl(
    `${providerConfig.authorizationServer.origin}${providerConfig.authPath}`,
    authParams
  );

  const successResponse: OAuthAuthorizeSuccess = {
    success: true,
    authorizationUrl,
  };

  return new Response(JSON.stringify(successResponse), {
    status: HttpStatus.OK,
    headers: { "Content-Type": "application/json" },
  });
}
