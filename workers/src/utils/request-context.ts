// @agent: cloudflare-backend
// Request context management for user info, correlation, and session tracking
import type { AuditEventType } from "./audit-logger";
import * as HeaderUtils from "./header-utils";
import { ContextLogger, LogEntry } from "./context-logger";
import { ContextMetadata } from "./context-metadata";

export type { LogEntry } from "./context-logger";

export class RequestContext {
  readonly request: Request;
  correlationId: string;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  private logger = new ContextLogger();
  private metadataManager = new ContextMetadata();
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

  toAuditDetails(metadata?: Record<string, any>) {
    return {
      correlationId: this.correlationId,
      userId: this.userId,
      sessionId: this.sessionId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      ...(metadata && { metadata }),
    };
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

  setMetadata(key: string, value: any): void {
    this.metadataManager.set(key, value);
  }

  getMetadata(key: string): any {
    return this.metadataManager.get(key);
  }

  log(
    eventType: AuditEventType,
    result: "success" | "failure",
    metadata?: Record<string, any>
  ): void {
    this.logger.log(
      eventType,
      result,
      {
        correlationId: this.correlationId,
        userId: this.userId,
        sessionId: this.sessionId,
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
      },
      metadata,
      this.metadataManager.getAll()
    );
  }

  getLogs(): LogEntry[] {
    return this.logger.getLogs();
  }

  clearLogs(): void {
    this.logger.clearLogs();
  }

  createChild(): RequestContext {
    const child = new RequestContext(this.request);
    child.correlationId = this.correlationId;
    child.userId = this.userId;
    child.userEmail = this.userEmail;
    child.sessionId = this.sessionId;
    child.ipAddress = this.ipAddress;
    child.userAgent = this.userAgent;
    this.metadataManager.copyTo(child.metadataManager);
    return child;
  }

  updateCorrelationId(newId: string): void {
    this.correlationId = newId;
  }
}
