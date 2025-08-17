// @agent: cloudflare-backend
/**
 * PKCE challenge validation utilities
 */

import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { AuditEventType } from "../utils/audit-logger";
import { AuditedKVStore } from "../utils/audit-kvstore";
import { validatePKCE } from "./oauth-validation";

export async function validateStoredChallenge(
  env: Env,
  state: string,
  codeVerifier: string,
  context: RequestContext
) {
  const auditedKV = new AuditedKVStore(env.OAUTH_SESSIONS);
  const storedChallengeData = await auditedKV.get(
    `pkce:${state}`,
    context.userId || "anonymous"
  );
  if (!storedChallengeData) {
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, "failure", {
      reason: "No stored PKCE challenge found",
    });
    return null;
  }

  let challengeInfo;
  try {
    challengeInfo = JSON.parse(storedChallengeData);
  } catch (error) {
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, "failure", {
      reason: "Invalid stored challenge data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }

  if (
    !challengeInfo.state ||
    challengeInfo.state !== state ||
    (challengeInfo.expiresAt && Date.now() > challengeInfo.expiresAt)
  ) {
    const reason = !challengeInfo.state
      ? "Missing stored state"
      : challengeInfo.state !== state
      ? "State parameter mismatch"
      : "PKCE session expired";
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, "failure", {
      reason,
    });
    if (challengeInfo.expiresAt && Date.now() > challengeInfo.expiresAt) {
      await auditedKV.delete(`pkce:${state}`, context.userId || "anonymous");
    }
    return null;
  }

  const isValid = await validatePKCE(codeVerifier, challengeInfo.challenge);
  if (!isValid) {
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, "failure", {
      reason: "PKCE verification failed",
    });
    return null;
  }

  await auditedKV.delete(`pkce:${state}`, context.userId || "anonymous");
  context.log(AuditEventType.PKCE_VERIFICATION_SUCCESS, "success", { state });
  return challengeInfo;
}

export async function parseRequestParams(
  request: Request,
  context: RequestContext
) {
  // Only accept POST requests for OAuth callback (security best practice)
  if (request.method !== "POST") {
    context.log(AuditEventType.AUTH_LOGIN_FAILURE, "failure", {
      reason: "Invalid request method",
      method: request.method,
    });
    return null;
  }
  
  try {
    const body = (await request.json()) as any;
    return {
      code: body.code || null,
      state: body.state || null,
      codeVerifier: body.code_verifier || null,
    };
  } catch (error) {
    context.log(AuditEventType.AUTH_LOGIN_FAILURE, "failure", {
      reason: "Invalid JSON body",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
