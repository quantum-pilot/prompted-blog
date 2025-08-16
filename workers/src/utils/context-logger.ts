// @agent: cloudflare-backend
// Logging functionality for RequestContext

import { AuditLogger, AuditEventType } from './audit-logger';

export interface LogEntry {
  timestamp: string;
  eventType: AuditEventType;
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
}

export class ContextLogger {
  private logs: LogEntry[] = [];

  log(
    eventType: AuditEventType,
    result: 'success' | 'failure',
    contextData: {
      correlationId: string;
      userId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    metadata?: Record<string, any>,
    contextMetadata?: Map<string, any>
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
      correlationId: contextData.correlationId,
      userId: contextData.userId,
      sessionId: contextData.sessionId,
      ipAddress: contextData.ipAddress,
      userAgent: contextData.userAgent,
      ...metadata,
      metadata: {
        ...(contextMetadata ? Object.fromEntries(contextMetadata) : {}),
        ...metadata
      }
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}