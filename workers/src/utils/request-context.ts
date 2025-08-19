// @agent: cloudflare-backend
// Request context management for user info, correlation, and session tracking
import { AuditLogger, AuditEventType } from "./audit-logger";
import * as HeaderUtils from "./header-utils";
import { applySecurityHeaders } from "./security-headers";
import { getCorsHeaders } from "./cors-utils";
import type { Env } from "../oauth-client/types";
import { HttpStatus } from "../../../shared";

export class RequestContext {
  readonly request: Request;
  correlationId: string;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  private _url?: URL;

  constructor(request: Request) {
    this.request = request;
    this.correlationId = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;
    this.timestamp = new Date();
  }

  // Getter for origin header
  get origin(): string | null {
    return this.request.headers.get("Origin");
  }

  // Getter for URL (cached)
  get url(): URL {
    if (!this._url) {
      this._url = new URL(this.request.url);
    }
    return this._url;
  }

  // Getter for HTTP method
  get method(): string {
    return this.request.method;
  }

  // Getter for headers
  get headers(): Headers {
    return this.request.headers;
  }

  static async create(request: Request, _env: any): Promise<RequestContext> {
    const context = new RequestContext(request);
    const url = new URL(request.url);
    const extractedId = HeaderUtils.extractCorrelationId(
      request,
      url.searchParams.get("state")
    );
    if (extractedId) context.correlationId = extractedId;
    context.ipAddress = HeaderUtils.extractIpAddress(request);
    context.userAgent = HeaderUtils.extractUserAgent(request);
    context.sessionId = HeaderUtils.extractSessionIdFromCookie(request);
    const jwtPayload = HeaderUtils.extractUserInfoFromJWT(request);
    if (jwtPayload) {
      context.userId = jwtPayload.sub || jwtPayload.id;
      context.userEmail = jwtPayload.email;
    }
    return context;
  }

  propagate(request?: Request): Request {
    return HeaderUtils.setPropagationHeaders(request || this.request, {
      correlationId: this.correlationId,
      userId: this.userId,
      sessionId: this.sessionId,
    });
  }

  enrichFromSession(sessionData: any): void {
    if (sessionData?.id) this.userId = sessionData.id;
    if (sessionData?.email) this.userEmail = sessionData.email;
  }

  log(
    eventType: AuditEventType,
    result: "success" | "failure",
    metadata?: Record<string, any>
  ): void {
    AuditLogger.log(eventType, result, {
      userId: this.userId,
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      metadata: metadata,
    });
  }

  /**
   * Create an error response with consistent formatting, logging, and headers
   */
  errorResponse(
    status: number,
    errorCode: string,
    errorDescription: string = "Request failed",
    env?: Env,
    auditEvent?: AuditEventType,
    auditMetadata?: Record<string, any>
  ): Response {
    // Log the error if audit event is provided
    if (auditEvent) {
      this.log(auditEvent, "failure", {
        errorCode,
        reason: errorDescription,
        ...auditMetadata
      });
    }

    // Build the error response body
    const responseBody = {
      error: errorCode,
      error_description: errorDescription
    };

    // Build response headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...getCorsHeaders(this, env)
    };

    // Create the response
    const response = new Response(JSON.stringify(responseBody), {
      status,
      headers
    });

    // Apply security headers and return
    return applySecurityHeaders(response);
  }

  /**
   * Create a success response with consistent formatting and headers
   */
  successResponse(
    data: any,
    env?: Env,
    status: number = HttpStatus.OK
  ): Response {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...getCorsHeaders(this, env)
    };

    const response = new Response(JSON.stringify(data), {
      status,
      headers
    });

    return applySecurityHeaders(response);
  }
}
