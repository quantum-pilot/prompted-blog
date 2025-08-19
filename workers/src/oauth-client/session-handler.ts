// @agent: cloudflare-backend
/**
 * Session management handler
 */

import { 
  HttpStatus,
  SessionValidationSuccess,
  SessionValidationError,
  SessionValidationHeaders,
  HealthCheckResponse
} from "../../../shared";
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
    
    const errorResponse: SessionValidationError = {
      error: "invalid_request",
      error_description: "Missing or invalid Authorization header"
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: HttpStatus.BAD_REQUEST,
      headers: { "Content-Type": "application/json" }
    });
  }

  const sessionId = authHeader.substring(7); // Remove 'Bearer ' prefix

  // SECURITY: Validate session ID format to prevent injection attacks
  if (!isValidSessionId(sessionId)) {
    context.log(AuditEventType.AUTH_SESSION_INVALID, "failure", {
      reason: "Invalid session ID format",
      sessionIdLength: sessionId.length,
    });
    
    const errorResponse: SessionValidationError = {
      error: "invalid_request",
      error_description: "Authentication failed"
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: HttpStatus.BAD_REQUEST,
      headers: { "Content-Type": "application/json" }
    });
  }

  const sessionManager = new SessionManager(env);
  const session = await sessionManager.validateSession(sessionId, context);

  if (!session) {
    const errorResponse: SessionValidationError = {
      error: "session_not_found",
      error_description: "Authentication failed"
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: HttpStatus.NOT_FOUND,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Return typed session data (excluding sensitive fields)
  const successResponse: SessionValidationSuccess = {
    userId: session.userId,
    email: session.email,
    name: session.name,
    picture: session.picture,
    provider: session.provider as "google" | "github",
    expiresAt: session.expiresAt,
  };
  
  return new Response(JSON.stringify(successResponse), {
    status: HttpStatus.OK,
    headers: { "Content-Type": "application/json" }
  });
}

export async function handleHealthCheck(
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = context.origin;

  const healthResponse: HealthCheckResponse = {
    status: "ok",
    timestamp: Date.now()
  };
  
  return new Response(JSON.stringify(healthResponse), {
    status: HttpStatus.OK,
    headers: { "Content-Type": "application/json" }
  });
}
