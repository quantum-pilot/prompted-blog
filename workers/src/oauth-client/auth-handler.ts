// @agent: cloudflare-backend
/**
 * OAuth authorization initiation handler
 */

import { HTTP_STATUS } from "../../../shared";
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
  const provider = url.searchParams.get("provider");

  if (!codeChallenge || !state || !provider || !isValidStateParameter(state)) {
    return context.errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      "invalid_request",
      "Authentication failed",
      env,
      AuditEventType.PKCE_CHALLENGE_STORE_FAILURE,
      { reason: "Missing or invalid parameters" }
    );
  }

  // Store the PKCE challenge with a 10-minute expiration
  const challengeData = {
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

  // Get provider configuration
  const providerConfig = getProvider(provider, env);

  // Build authorization URL
  const authUrl = new URL(
    providerConfig.authPath,
    providerConfig.authorizationServer
  );
  authUrl.searchParams.set("client_id", providerConfig.clientId);
  authUrl.searchParams.set("redirect_uri", providerConfig.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", providerConfig.scopes.join(" "));
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  return context.successResponse(
    {
      success: true,
      authorizationUrl: authUrl.toString(),
    },
    env
  );
}
