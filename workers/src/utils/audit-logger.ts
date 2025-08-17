// @agent: cloudflare-backend
// Structured audit logging for security and compliance monitoring
// Implements secure logging practices without exposing sensitive data

import { AuditEventType, LogLevel, AuditLogEntry } from "./audit-types";

export { AuditEventType, LogLevel } from "./audit-types";

export class AuditLogger {
  private static generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private static sanitizeMetadata(
    metadata?: Record<string, any>
  ): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
      "cookie",
    ];

    Object.keys(sanitized).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  private static determineLogLevel(
    eventType: AuditEventType,
    result: "success" | "failure"
  ): LogLevel {
    if (
      eventType === AuditEventType.AUTH_LOGIN_FAILURE ||
      eventType === AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY ||
      eventType === AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED ||
      eventType === AuditEventType.DATA_ACCESS_DENIED
    ) {
      return LogLevel.WARN;
    }

    return result === "failure" ? LogLevel.ERROR : LogLevel.INFO;
  }

  static log(
    eventType: AuditEventType,
    result: "success" | "failure",
    details: {
      userId?: string;
      sessionId?: string;
      correlationId?: string;
      ipAddress?: string;
      userAgent?: string;
      resource?: string;
      action?: string;
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const level = this.determineLogLevel(eventType, result);

    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      level,
      result,
      correlationId: details.correlationId || this.generateCorrelationId(),
      userId: details.userId,
      sessionId: details.sessionId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      resource: details.resource,
      action: details.action,
      metadata: this.sanitizeMetadata(details.metadata),
    };

    console.log(JSON.stringify({ audit: true, ...logEntry }));
  }

  static logAuthSuccess(
    userId: string,
    sessionId: string,
    request: Request
  ): void {
    this.log(AuditEventType.AUTH_LOGIN_SUCCESS, "success", {
      userId,
      sessionId,
      ipAddress: request.headers.get("CF-Connecting-IP") || undefined,
      userAgent: request.headers.get("User-Agent") || undefined,
    });
  }

  static logAuthFailure(
    attemptedEmail: string,
    reason: string,
    request: Request
  ): void {
    this.log(AuditEventType.AUTH_LOGIN_FAILURE, "failure", {
      ipAddress: request.headers.get("CF-Connecting-IP") || undefined,
      userAgent: request.headers.get("User-Agent") || undefined,
      metadata: { attemptedEmail, reason },
    });
  }

  static logSessionCreated(userId: string, sessionId: string): void {
    this.log(AuditEventType.AUTH_SESSION_CREATED, "success", {
      userId,
      sessionId,
    });
  }

  static logSessionDestroyed(userId: string, sessionId: string): void {
    this.log(AuditEventType.AUTH_SESSION_DESTROYED, "success", {
      userId,
      sessionId,
    });
  }

  static logDataAccess(
    userId: string,
    resource: string,
    action: string,
    success: boolean
  ): void {
    const eventMap = {
      read: success
        ? AuditEventType.DATA_ACCESS_READ
        : AuditEventType.DATA_ACCESS_DENIED,
      write: success
        ? AuditEventType.DATA_ACCESS_WRITE
        : AuditEventType.DATA_ACCESS_DENIED,
      delete: success
        ? AuditEventType.DATA_ACCESS_DELETE
        : AuditEventType.DATA_ACCESS_DENIED,
    };

    const eventType =
      eventMap[action as keyof typeof eventMap] ||
      AuditEventType.DATA_ACCESS_READ;
    this.log(eventType, success ? "success" : "failure", {
      userId,
      resource,
      action,
    });
  }
}
