// @agent: cloudflare-backend
// Request context management for user info, correlation, and session tracking
import type { Env } from '../oauth-provider/types';
import { AuditLogger, AuditEventType } from './audit-logger';

export interface LogEntry {
  timestamp: string;
  eventType: AuditEventType;
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
}

export class RequestContext {
  readonly request: Request;
  correlationId: string;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  private logs: LogEntry[] = [];
  private metadata: Map<string, any> = new Map();

  constructor(request?: Request) {
    // For backwards compatibility with tests, create a dummy request if not provided
    this.request = request || new Request('https://test.example.com/');
    this.correlationId = this.generateCorrelationId();
    this.timestamp = new Date();
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  static async create(request: Request, _env: Env): Promise<RequestContext> {
    const context = new RequestContext(request);

    // Extract correlation ID from headers, state parameter, or keep generated one
    const headerCorrelationId = request.headers.get('X-Correlation-ID');
    const url = new URL(request.url);
    const stateParam = url.searchParams.get('state');

    // Priority: state parameter > header > generated
    if (stateParam) {
      context.correlationId = stateParam;
    } else if (headerCorrelationId) {
      context.correlationId = headerCorrelationId;
    }

    // Extract IP and user agent
    context.ipAddress = request.headers.get('CF-Connecting-IP') || undefined;
    context.userAgent = request.headers.get('User-Agent') || undefined;

    // Extract session ID from cookie
    const cookies = request.headers.get('Cookie');
    if (cookies) {
      const sessionCookie = cookies.split(';')
        .find(c => c.trim().startsWith('session='));
      if (sessionCookie) {
        context.sessionId = sessionCookie.split('=')[1].trim();
      }
    }

    // Extract user info from JWT if present
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          context.userId = payload.sub || payload.id;
          context.userEmail = payload.email;
        }
      } catch {
        // Invalid JWT - ignore extraction
      }
    }

    return context;
  }

  toAuditDetails(metadata?: Record<string, any>): {
    correlationId: string;
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  } {
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
    const targetRequest = request || this.request;
    const headers = new Headers(targetRequest.headers);
    headers.set('X-Correlation-ID', this.correlationId);
    if (this.userId) headers.set('X-User-ID', this.userId);
    if (this.sessionId) headers.set('X-Session-ID', this.sessionId);

    return new Request(targetRequest, { headers });
  }

  // Helper for session manager integration
  enrichFromSession(sessionData: any): void {
    if (sessionData?.id) this.userId = sessionData.id;
    if (sessionData?.email) this.userEmail = sessionData.email;
  }

  // Set custom metadata for context
  setMetadata(key: string, value: any): void {
    this.metadata.set(key, value);
  }

  // Get custom metadata
  getMetadata(key: string): any {
    return this.metadata.get(key);
  }

  // Log an event through the context
  log(
    eventType: AuditEventType,
    result: 'success' | 'failure',
    metadata?: Record<string, any>
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      result,
      metadata
    };

    this.logs.push(logEntry);

    // Immediately send to AuditLogger with context details and metadata flattened
    AuditLogger.log(eventType, result, {
      correlationId: this.correlationId,
      userId: this.userId,
      sessionId: this.sessionId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      ...metadata,
      metadata: {
        ...Object.fromEntries(this.metadata),
        ...metadata
      }
    });
  }

  // Get all logs for this context
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs (useful for long-running contexts)
  clearLogs(): void {
    this.logs = [];
  }

  // Create a child context with the same correlation ID
  createChild(): RequestContext {
    const child = new RequestContext(this.request);
    child.correlationId = this.correlationId;
    child.userId = this.userId;
    child.userEmail = this.userEmail;
    child.sessionId = this.sessionId;
    child.ipAddress = this.ipAddress;
    child.userAgent = this.userAgent;
    // Copy metadata to child
    this.metadata.forEach((value, key) => {
      child.metadata.set(key, value);
    });
    return child;
  }

  // Update correlation ID (use with caution)
  updateCorrelationId(newId: string): void {
    this.correlationId = newId;
  }
}
