// @agent: cloudflare-backend
// Data access audit decorator for automatic logging

import { AuditLogger } from './audit-logger';

import { RequestContext } from './request-context';

export interface DataAccessContext {
  requestContext: RequestContext;
  resource: string;
  operation: 'read' | 'write' | 'delete';
}

/**
 * Decorator for methods that access sensitive data
 * Automatically logs successful and failed data access attempts
 */
export function auditDataAccess(resourceType: string): any {
  return function (target: any, propertyName: string | symbol, descriptor?: PropertyDescriptor): any {
    // Handle case where descriptor might be undefined (different decorator compilation)
    if (!descriptor) {
      return;
    }
    
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = args.find(arg => arg && typeof arg === 'object' && 'requestContext' in arg) as DataAccessContext | undefined;
      
      if (!context || !context.requestContext) {
        console.warn(`Missing audit context for ${resourceType}.${String(propertyName)}`);
        return originalMethod.apply(this, args);
      }
      
      // Use 'system' as default userId if not set (e.g., during OAuth flow initialization)
      const userId = context.requestContext.userId || 'system';

      try {
        const result = await originalMethod.apply(this, args);
        
        AuditLogger.logDataAccess(
          userId,
          `${resourceType}.${String(propertyName)}`,
          context.operation || 'read',
          true
        );
        
        return result;
      } catch (error) {
        AuditLogger.logDataAccess(
          userId,
          `${resourceType}.${String(propertyName)}`,
          context.operation || 'read',
          false
        );
        
        throw error;
      }
    };

    return descriptor;
  };
}