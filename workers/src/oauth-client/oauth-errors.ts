// @agent: cloudflare-backend
/**
 * OAuth error handling utilities
 */

import type { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';

export function jsonResponse(
  error: { error: string; error_description: string },
  status: number,
  origin?: string,
  context?: RequestContext
): Response {
  return new Response(JSON.stringify(error), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function logAndReturnError(
  context: RequestContext,
  eventType: AuditEventType,
  reason: string,
  errorCode: string,
  status: number,
  error?: unknown
): Response {
  const metadata: any = { reason };
  if (error) {
    metadata.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  context.log(eventType, 'failure', metadata);
  
  return jsonResponse({
    error: errorCode,
    error_description: 'Authentication failed'
  }, status, undefined, context);
}