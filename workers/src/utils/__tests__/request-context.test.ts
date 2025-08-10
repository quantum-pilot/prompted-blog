// @agent: cloudflare-backend
import { describe, it, expect, beforeEach } from 'vitest';
import { RequestContext } from '../request-context';
import type { Env } from '../../oauth-google/types';

describe('RequestContext', () => {
  let mockEnv: Env;
  let mockRequest: Request;
  
  beforeEach(() => {
    mockEnv = {
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'https://example.com/callback',
      SESSION_ENCRYPTION_KEY: btoa('test-encryption-key-32-bytes-ok'),
      OAUTH_SESSIONS: {} as any,
    };
    
    mockRequest = new Request('https://example.com/api/test', {
      headers: {
        'CF-Connecting-IP': '192.168.1.1',
        'User-Agent': 'Mozilla/5.0',
        'X-Correlation-ID': 'existing-correlation-123',
      },
    });
  });

  describe('RequestContext.create', () => {
    it('should create context with correlation ID from headers', async () => {
      const context = await RequestContext.create(mockRequest, mockEnv);
      
      expect(context.correlationId).toBe('existing-correlation-123');
      expect(context.ipAddress).toBe('192.168.1.1');
      expect(context.userAgent).toBe('Mozilla/5.0');
      expect(context.timestamp).toBeInstanceOf(Date);
    });
    
    it('should generate correlation ID if not in headers', async () => {
      const req = new Request('https://example.com/api/test');
      const context = await RequestContext.create(req, mockEnv);
      
      expect(context.correlationId).toMatch(/^\d+-[a-z0-9]{9}$/);
    });
    
    it('should extract session ID from cookie', async () => {
      const req = new Request('https://example.com/api/test', {
        headers: {
          'Cookie': 'session=session-uuid-123; other=value',
        },
      });
      
      const context = await RequestContext.create(req, mockEnv);
      expect(context.sessionId).toBe('session-uuid-123');
    });
    
    it('should extract user info from JWT bearer token', async () => {
      // Simple JWT mock (header.payload.signature)
      const payload = btoa(JSON.stringify({ sub: 'user-123', email: 'test@example.com' }));
      const mockJWT = `header.${payload}.signature`;
      
      const req = new Request('https://example.com/api/test', {
        headers: {
          'Authorization': `Bearer ${mockJWT}`,
        },
      });
      
      const context = await RequestContext.create(req, mockEnv);
      expect(context.userId).toBe('user-123');
      expect(context.userEmail).toBe('test@example.com');
    });
  });

  describe('RequestContext.toAuditDetails', () => {
    it('should convert context to audit log details', async () => {
      const context = await RequestContext.create(mockRequest, mockEnv);
      const details = context.toAuditDetails();
      
      expect(details).toEqual({
        correlationId: 'existing-correlation-123',
        userId: undefined,
        sessionId: undefined,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
    });
    
    it('should include metadata if provided', async () => {
      const context = await RequestContext.create(mockRequest, mockEnv);
      const details = context.toAuditDetails({ action: 'login', provider: 'google' });
      
      expect(details.metadata).toEqual({
        action: 'login',
        provider: 'google',
      });
    });
  });

  describe('RequestContext.propagate', () => {
    it('should add context headers to outgoing request', async () => {
      const context = await RequestContext.create(mockRequest, mockEnv);
      context.userId = 'user-123';
      context.sessionId = 'session-456';
      
      const outgoingReq = new Request('https://api.example.com/data');
      const propagated = context.propagate(outgoingReq);
      
      expect(propagated.headers.get('X-Correlation-ID')).toBe('existing-correlation-123');
      expect(propagated.headers.get('X-User-ID')).toBe('user-123');
      expect(propagated.headers.get('X-Session-ID')).toBe('session-456');
    });
  });

  describe('Performance', () => {
    it('should create context in less than 50ms', async () => {
      const start = performance.now();
      await RequestContext.create(mockRequest, mockEnv);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });
  });
});