// @agent: cloudflare-backend
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager, SessionData } from '../session-manager';
import type { Env } from '../types';

describe('SessionManager Encryption', () => {
  let mockEnv: Env;
  let sessionManager: SessionManager;
  
  beforeEach(() => {
    // Create mock KV store with Map
    const kvStore = new Map<string, string>();
    
    mockEnv = {
      GOOGLE_CLIENT_ID: 'test-google-client',
      CLIENT_ID: 'test-client',
      REDIRECT_URI: 'http://localhost:3000/callback',
      FRONTEND_URL: 'http://localhost:3000',
      SESSION_ENCRYPTION_KEY: 'test-encryption-key-must-be-long-enough',
      OAUTH_SESSIONS: {
        put: async (key: string, value: string, options?: any) => {
          kvStore.set(key, value);
        },
        get: async (key: string) => kvStore.get(key) || null,
        delete: async (key: string) => {
          kvStore.delete(key);
        }
      } as any,
      OAUTH_KV: {} as any
    };
    
    sessionManager = new SessionManager(mockEnv);
  });

  it('should store session data without encryption', async () => {
    const sessionData = {
      provider: 'google',
      userId: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      expiresAt: Date.now() + 3600000 // 1 hour from now
    };
    
    const sessionId = await sessionManager.createSession(sessionData);
    
    // Get raw data from KV store
    const rawData = await mockEnv.OAUTH_SESSIONS.get(`session:${sessionId}`);
    expect(rawData).toBeDefined();
    
    // Parse stored data - should be plain JSON (no encryption for now)
    const stored = JSON.parse(rawData!);
    expect(stored).toHaveProperty('userId');
    expect(stored.userId).toBe('user123');
    expect(stored.email).toBe('test@example.com');
    // Note: In production, this should be encrypted
  });

  it('should retrieve session data without decryption', async () => {
    const sessionData = {
      provider: 'google',
      userId: 'user456',
      email: 'another@example.com',
      name: 'Another User',
      expiresAt: Date.now() + 3600000
    };
    
    const sessionId = await sessionManager.createSession(sessionData);
    const retrieved = await sessionManager.getSession(sessionId);
    
    expect(retrieved).toBeDefined();
    expect(retrieved!.userId).toBe('user456');
    expect(retrieved!.email).toBe('another@example.com');
    expect(retrieved!.name).toBe('Another User');
  });

  it('should store OAuth state data without encryption', async () => {
    const stateData = {
      codeChallenge: 'test-challenge',
      redirectUri: 'http://localhost:3000/callback'
    };
    
    await sessionManager.storeOAuthState('test-state', stateData);
    
    // Get raw data from KV store
    const rawData = await mockEnv.OAUTH_SESSIONS.get('state:test-state');
    expect(rawData).toBeDefined();
    
    // Should be plain JSON (no encryption for now)
    const stored = JSON.parse(rawData!);
    expect(stored).toHaveProperty('codeChallenge');
    expect(stored.codeChallenge).toBe('test-challenge');
    // Note: In production, this should be encrypted
  });
});