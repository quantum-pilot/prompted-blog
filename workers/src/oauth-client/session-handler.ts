// @agent: cloudflare-backend
/**
 * Session management handler
 */

import { HTTP_STATUS } from "../../../shared";
import { RequestContext } from "../utils/request-context";
import { AuditEventType } from "../utils/audit-logger";
import { SessionManager } from "./session-manager";
import type { Env } from "./types";
import { isValidSessionId } from "./session-validation";

export async function handleSessionGet(
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = context.origin;

  // Extract session ID from Authorization header
  const authHeader = context.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    context.log(AuditEventType.AUTH_SESSION_INVALID, "failure", {
      reason: "Missing session ID in Authorization header",
    });
    return context.errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      "invalid_request",
      "Authentication failed",
      env
    );
  }

  const sessionId = authHeader.substring(7); // Remove 'Bearer ' prefix

  // SECURITY: Validate session ID format to prevent injection attacks
  if (!isValidSessionId(sessionId)) {
    context.log(AuditEventType.AUTH_SESSION_INVALID, "failure", {
      reason: "Invalid session ID format",
      sessionIdLength: sessionId.length,
    });
    return context.errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      "invalid_request",
      "Authentication failed",
      env
    );
  }

  const sessionManager = new SessionManager(env);
  const session = await sessionManager.validateSession(sessionId, context);

  if (!session) {
    return context.errorResponse(
      HTTP_STATUS.NOT_FOUND,
      "invalid_grant",
      "Authentication failed",
      env
    );
  }

  // Return session data (excluding sensitive fields)
  return context.successResponse(
    {
      userId: session.userId,
      email: session.email,
      name: session.name,
      picture: session.picture,
      provider: session.provider,
      expiresAt: session.expiresAt,
    },
    env
  );
}

export async function handleHealthCheck(
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = context.origin;

  return context.successResponse(
    { status: "ok", timestamp: Date.now() },
    env
  );
}
