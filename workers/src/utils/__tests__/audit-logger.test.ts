// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { AuditLogger, AuditEventType } from '../audit-logger';

describe('AuditLogger', () => {
  let consoleLogSpy: MockedFunction<typeof console.log>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) as MockedFunction<typeof console.log>;
  });

  it('creates properly structured audit entries', () => {
    AuditLogger.log(AuditEventType.AUTH_LOGIN_SUCCESS, 'success', {
      userId: 'user-123',
      sessionId: 'sess-789'
    });
    
    const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
    
    expect(logEntry).toMatchObject({
      audit: true,
      eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
      result: 'success',
      userId: 'user-123',
      sessionId: 'sess-789',
      correlationId: expect.stringMatching(/^\d+-[a-z0-9]+$/),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    });
  });

  it('generates unique correlation IDs', () => {
    AuditLogger.log(AuditEventType.DATA_ACCESS_READ, 'success', {});
    AuditLogger.log(AuditEventType.DATA_ACCESS_READ, 'success', {});
    
    const log1 = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
    const log2 = JSON.parse(consoleLogSpy.mock.calls[1][0] as string);
    
    expect(log1.correlationId).not.toBe(log2.correlationId);
  });

  it('sanitizes sensitive metadata keys', () => {
    AuditLogger.log(AuditEventType.AUTH_TOKEN_REFRESHED, 'success', {
      metadata: {
        authorization: 'Bearer secret-token',
        password: 'supersecret',
        apiKey: 'key-123',
        normalData: 'visible'
      }
    });
    
    const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
    
    expect(logEntry.metadata).toEqual({
      authorization: '[REDACTED]',
      password: '[REDACTED]',
      apiKey: '[REDACTED]',
      normalData: 'visible'
    });
  });

  it('uses appropriate log levels', () => {
    // WARN for auth failures
    AuditLogger.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', {});
    let logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
    expect(logEntry.level).toBe('WARN');
    
    // ERROR for general failures
    AuditLogger.log(AuditEventType.DATA_ACCESS_WRITE, 'failure', {});
    logEntry = JSON.parse(consoleLogSpy.mock.calls[1][0] as string);
    expect(logEntry.level).toBe('ERROR');
    
    // INFO for success
    AuditLogger.log(AuditEventType.AUTH_LOGIN_SUCCESS, 'success', {});
    logEntry = JSON.parse(consoleLogSpy.mock.calls[2][0] as string);
    expect(logEntry.level).toBe('INFO');
  });

  it('logs auth success with request details', () => {
    const mockRequest = new Request('https://example.com', {
      headers: {
        'CF-Connecting-IP': '192.168.1.1',
        'User-Agent': 'TestBrowser/1.0'
      }
    });
    
    AuditLogger.logAuthSuccess('user-123', 'session-456', mockRequest);
    
    const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
    expect(logEntry).toMatchObject({
      eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
      userId: 'user-123',
      sessionId: 'session-456',
      ipAddress: '192.168.1.1',
      userAgent: 'TestBrowser/1.0'
    });
  });
});