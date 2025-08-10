// @agent: cloudflare-backend
import { describe, it, expect, vi } from 'vitest';
import { withDataAccessAudit, compose, MiddlewareHandler } from '../../utils/middleware';
import { RequestContext } from '../../utils/request-context';
import { AuditLogger } from '../../utils/audit-logger';
import type { Env } from '../types';

// Mock AuditLogger
vi.mock('../../utils/audit-logger', () => ({
  AuditLogger: {
    logDataAccess: vi.fn()
  }
}));

describe('Middleware Wrapper Verification', () => {
  it('should wrap handler and log successful data access', async () => {
    const mockEnv = {} as Env;
    const request = new Request('https://example.com/test');
    const mockContext = new RequestContext(request);
    mockContext.userId = 'test-user';

    const handler: MiddlewareHandler = async () => {
      return new Response('Success', { status: 200 });
    };

    const wrappedHandler = withDataAccessAudit('test-resource', 'read')(handler);

    const response = await wrappedHandler(mockEnv, mockContext);

    expect(response.status).toBe(200);
    expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
      'test-user',
      'test-resource',
      'read',
      true
    );
  });

  it('should compose multiple middleware correctly', async () => {
    const mockEnv = {} as Env;
    const request = new Request('https://example.com/test');
    const mockContext = new RequestContext(request);
    mockContext.userId = 'test-user';

    const executionOrder: string[] = [];

    const handler: MiddlewareHandler = async () => {
      executionOrder.push('handler');
      return new Response('Success', { status: 200 });
    };

    const middleware1 = withDataAccessAudit('resource1', 'read');
    const middleware2 = withDataAccessAudit('resource2', 'write');

    const composedHandler = compose(middleware1, middleware2)(handler);

    const response = await composedHandler(mockEnv, mockContext);

    expect(response.status).toBe(200);
    expect(executionOrder).toEqual(['handler']);

    // Both middleware should have logged
    expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
      'test-user',
      'resource1',
      'read',
      true
    );
    expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
      'test-user',
      'resource2',
      'write',
      true
    );
  });

  it('should add correlation ID to response', async () => {
    const mockEnv = {} as Env;
    const request = new Request('https://example.com/test');
    const mockContext = new RequestContext(request);
    mockContext.correlationId = 'test-correlation-123';
    mockContext.userId = 'test-user';

    const handler: MiddlewareHandler = async () => {
      return new Response('Success', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    };

    const wrappedHandler = withDataAccessAudit('test-resource', 'read')(handler);

    const response = await wrappedHandler(mockEnv, mockContext);

    expect(response.headers.get('X-Correlation-ID')).toBe('test-correlation-123');
    expect(response.headers.get('Content-Type')).toBe('text/plain');
  });

  it('should log failure on exception', async () => {
    const mockEnv = {} as Env;
    const request = new Request('https://example.com/test');
    const mockContext = new RequestContext(request);
    mockContext.userId = 'test-user';

    const handler: MiddlewareHandler = async () => {
      throw new Error('Test error');
    };

    const wrappedHandler = withDataAccessAudit('test-resource', 'delete')(handler);

    await expect(wrappedHandler(mockEnv, mockContext)).rejects.toThrow('Test error');

    expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
      'test-user',
      'test-resource',
      'delete',
      false
    );
  });

  it('should handle anonymous users', async () => {
    const mockEnv = {} as Env;
    const request = new Request('https://example.com/test');
    const mockContext = new RequestContext(request);
    // No userId set - should default to 'anonymous'

    const handler: MiddlewareHandler = async () => {
      return new Response('Success', { status: 200 });
    };

    const wrappedHandler = withDataAccessAudit('public-resource', 'read')(handler);

    const response = await wrappedHandler(mockEnv, mockContext);

    expect(response.status).toBe(200);
    expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
      'anonymous',
      'public-resource',
      'read',
      true
    );
  });

  it('should complete in less than 50ms', async () => {
    const mockEnv = {} as Env;
    const request = new Request('https://example.com/test');
    const mockContext = new RequestContext(request);
    mockContext.userId = 'test-user';

    const handler: MiddlewareHandler = async () => {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 5));
      return new Response('Success', { status: 200 });
    };

    const wrappedHandler = compose(
      withDataAccessAudit('resource1', 'read'),
      withDataAccessAudit('resource2', 'write')
    )(handler);

    const start = Date.now();
    const response = await wrappedHandler(mockEnv, mockContext);
    const duration = Date.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(50);
  });
});
