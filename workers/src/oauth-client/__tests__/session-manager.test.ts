// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../session-manager';
import { RequestContext } from '../../utils/request-context';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockEnv: any;
  let kvStore: Map<string, { value: string; expiry?: number }>;

  beforeEach(() => {
    kvStore = new Map();
    
    mockEnv = {
      OAUTH_SESSIONS: {
        put: vi.fn(async (key: string, value: string, options?: any) => {
          kvStore.set(key, { 
            value, 
            expiry: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined 
          });
        }),
        get: vi.fn(async (key: string) => {
          const item = kvStore.get(key);
          if (!item) return null;
          if (item.expiry && item.expiry < Date.now()) {
            kvStore.delete(key);
            return null;
          }
          return item.value;
        }),
        delete: vi.fn(async (key: string) => {
          kvStore.delete(key);
        })
      }
    };

    sessionManager = new SessionManager(mockEnv);
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const sessionData = {
        provider: 'google',
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        expiresAt: Date.now() + 3600000
      };

      const sessionId = await sessionManager.createSession(sessionData);
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(mockEnv.OAUTH_SESSIONS.put).toHaveBeenCalledWith(
        `session:${sessionId}`,
        expect.any(String),
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });

    it('should set correct TTL', async () => {
      const sessionData = {
        provider: 'google',
        userId: 'user-123',
        email: 'test@example.com',
        expiresAt: Date.now() + 7200000 // 2 hours
      };

      await sessionManager.createSession(sessionData);
      
      const putCall = mockEnv.OAUTH_SESSIONS.put.mock.calls[0];
      expect(putCall[2].expirationTtl).toBeLessThanOrEqual(7200);
      expect(putCall[2].expirationTtl).toBeGreaterThan(7190);
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const sessionData = {
        provider: 'google',
        userId: 'user-123',
        email: 'test@example.com',
        expiresAt: Date.now() + 3600000
      };

      const sessionId = await sessionManager.createSession(sessionData);
      const retrieved = await sessionManager.getSession(sessionId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe('user-123');
      expect(retrieved?.email).toBe('test@example.com');
    });

    it('should return null for non-existent session', async () => {
      // Use a valid session ID format that doesn't exist
      const validButNonExistentId = 'Abc123def456GHI789jkl012MNO345pqr678STU90XX';
      const retrieved = await sessionManager.getSession(validButNonExistentId);
      expect(retrieved).toBeNull();
    });

    it('should delete expired sessions', async () => {
      // Use a valid session ID format
      const sessionId = 'Expired123def456GHI789jkl012MNO345pqr678STU_';
      const sessionData = {
        id: sessionId,
        provider: 'google',
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: Date.now() - 7200000,
        expiresAt: Date.now() - 1000 // Already expired
      };
      
      // Store it directly
      kvStore.set(`session:${sessionId}`, { value: JSON.stringify(sessionData) });
      
      const retrieved = await sessionManager.getSession(sessionId);
      
      expect(retrieved).toBeNull();
      expect(mockEnv.OAUTH_SESSIONS.delete).toHaveBeenCalledWith(`session:${sessionId}`);
    });
  });

  describe('validateSession', () => {
    it('should validate and enrich context for valid session', async () => {
      const sessionData = {
        provider: 'google',
        userId: 'user-123',
        email: 'test@example.com',
        expiresAt: Date.now() + 3600000
      };

      const sessionId = await sessionManager.createSession(sessionData);
      const context = new RequestContext();
      
      const validated = await sessionManager.validateSession(sessionId, context);
      
      expect(validated).toBeDefined();
      expect(context.userId).toBe('user-123');
      expect(context.userEmail).toBe('test@example.com');
      expect(context.sessionId).toBe(sessionId);
    });

    it('should log failure for invalid session', async () => {
      const context = new RequestContext();
      const logSpy = vi.spyOn(context, 'log');
      
      // Use an invalid session ID that doesn't meet format requirements
      const invalidSessionId = 'invalid';
      const validated = await sessionManager.validateSession(invalidSessionId, context);
      
      expect(validated).toBeNull();
      // The validation should now log about invalid format, not missing session
      expect(logSpy).toHaveBeenCalledWith(
        expect.any(String),
        'failure',
        expect.objectContaining({ 
          reason: 'Invalid session ID format',
          sessionIdLength: invalidSessionId.length 
        })
      );
    });
  });

  describe('OAuth state management', () => {
    it('should store and retrieve OAuth state', async () => {
      const stateData = {
        codeChallenge: 'challenge-123',
        redirectUri: 'http://localhost:3000/callback'
      };

      await sessionManager.storeOAuthState('state_123', stateData);
      const retrieved = await sessionManager.getOAuthState('state_123');
      
      expect(retrieved).toEqual(stateData);
    });

    it('should delete state after retrieval', async () => {
      const stateData = { test: 'data' };
      
      await sessionManager.storeOAuthState('state_123', stateData);
      await sessionManager.getOAuthState('state_123');
      
      expect(mockEnv.OAUTH_SESSIONS.delete).toHaveBeenCalledWith('state:state_123');
      
      const secondRetrieval = await sessionManager.getOAuthState('state_123');
      expect(secondRetrieval).toBeNull();
    });
  });
});