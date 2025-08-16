// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager, SessionData } from '../session-manager';
import type { Env } from '../types';

describe('SessionManager Encryption', () => {
  let mockEnv: Env;
  let sessionManager: SessionManager;
  
  beforeEach(() => {
    // Create mock KV store with Map
    const kvStore = new Map<string, string>();
    
    // Generate a proper encryption key for testing (32 bytes)
    const testKey = 'test-encryption-key-must-be-32-bytes-long-exactly!';
    
    mockEnv = {
      GOOGLE_CLIENT_ID: 'test-google-client',
      CLIENT_ID: 'test-client',
      REDIRECT_URI: 'http://localhost:3000/callback',
      FRONTEND_URL: 'http://localhost:3000',
      SESSION_ENCRYPTION_KEY: testKey,
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

  describe('Session Data Encryption', () => {
    it('should encrypt session data before storing', async () => {
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
      
      // Verify data is encrypted (should not be readable JSON)
      expect(() => JSON.parse(rawData!)).toThrow();
      
      // Verify it's base64 encoded
      expect(() => atob(rawData!)).not.toThrow();
      
      // The encrypted data should not contain plaintext sensitive information
      expect(rawData).not.toContain('user123');
      expect(rawData).not.toContain('test@example.com');
      expect(rawData).not.toContain('Test User');
    });

    it('should decrypt session data when retrieving', async () => {
      const sessionData = {
        provider: 'google',
        userId: 'user456',
        email: 'another@example.com',
        name: 'Another User',
        picture: 'https://example.com/pic.jpg',
        expiresAt: Date.now() + 3600000
      };
      
      const sessionId = await sessionManager.createSession(sessionData);
      const retrieved = await sessionManager.getSession(sessionId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.userId).toBe('user456');
      expect(retrieved!.email).toBe('another@example.com');
      expect(retrieved!.name).toBe('Another User');
      expect(retrieved!.picture).toBe('https://example.com/pic.jpg');
      expect(retrieved!.provider).toBe('google');
    });

    it('should handle decryption errors gracefully', async () => {
      // Store invalid encrypted data directly
      const sessionId = 'Valid123def456GHI789jkl012MNO345pqr678STU90X';
      await mockEnv.OAUTH_SESSIONS.put(`session:${sessionId}`, 'invalid-encrypted-data');
      
      const retrieved = await sessionManager.getSession(sessionId);
      expect(retrieved).toBeNull();
    });

    it('should generate unique IVs for each encryption', async () => {
      const sessionData = {
        provider: 'google',
        userId: 'same-user',
        email: 'same@example.com',
        expiresAt: Date.now() + 3600000
      };
      
      // Create two sessions with identical data
      const sessionId1 = await sessionManager.createSession(sessionData);
      const sessionId2 = await sessionManager.createSession(sessionData);
      
      const encryptedData1 = await mockEnv.OAUTH_SESSIONS.get(`session:${sessionId1}`);
      const encryptedData2 = await mockEnv.OAUTH_SESSIONS.get(`session:${sessionId2}`);
      
      // Even with same plaintext, encrypted data should be different due to unique IVs
      expect(encryptedData1).not.toBe(encryptedData2);
    });
  });

  describe('OAuth State Encryption', () => {
    it('should encrypt OAuth state data before storing', async () => {
      const stateData = {
        codeChallenge: 'test-challenge-secret',
        redirectUri: 'http://localhost:3000/callback',
        someSecret: 'sensitive-data'
      };
      
      await sessionManager.storeOAuthState('test-state', stateData);
      
      // Get raw data from KV store
      const rawData = await mockEnv.OAUTH_SESSIONS.get('state:test-state');
      expect(rawData).toBeDefined();
      
      // Verify data is encrypted
      expect(() => JSON.parse(rawData!)).toThrow();
      
      // The encrypted data should not contain plaintext sensitive information
      expect(rawData).not.toContain('test-challenge-secret');
      expect(rawData).not.toContain('sensitive-data');
      expect(rawData).not.toContain('redirectUri');
    });

    it('should decrypt OAuth state data when retrieving', async () => {
      const stateData = {
        codeChallenge: 'challenge-abc123',
        redirectUri: 'http://localhost:3000/callback',
        customField: 'custom-value'
      };
      
      await sessionManager.storeOAuthState('state_123', stateData);
      const retrieved = await sessionManager.getOAuthState('state_123');
      
      expect(retrieved).toEqual(stateData);
      expect(retrieved.codeChallenge).toBe('challenge-abc123');
      expect(retrieved.customField).toBe('custom-value');
    });

    it('should handle state decryption errors gracefully', async () => {
      // Store invalid encrypted data directly
      await mockEnv.OAUTH_SESSIONS.put('state:bad-state', 'corrupted-data');
      
      const retrieved = await sessionManager.getOAuthState('bad-state');
      expect(retrieved).toBeNull();
    });

    it('should still delete state after failed decryption', async () => {
      const deleteSpy = vi.spyOn(mockEnv.OAUTH_SESSIONS, 'delete');
      
      // Store invalid encrypted data
      await mockEnv.OAUTH_SESSIONS.put('state:temp-state', 'bad-encrypted-data');
      
      // Try to retrieve it
      await sessionManager.getOAuthState('temp-state');
      
      // Should still delete the state even if decryption failed
      expect(deleteSpy).toHaveBeenCalledWith('state:temp-state');
    });
  });

  describe('Encryption Key Management', () => {
    it('should derive encryption key from environment variable', async () => {
      const sessionData = {
        provider: 'google',
        userId: 'key-test',
        email: 'key@test.com',
        expiresAt: Date.now() + 3600000
      };
      
      // Create and retrieve session to ensure key derivation works
      const sessionId = await sessionManager.createSession(sessionData);
      const retrieved = await sessionManager.getSession(sessionId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.userId).toBe('key-test');
    });

    it('should reuse the same encryption key for multiple operations', async () => {
      // Create multiple sessions to test key reuse
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const sessionId = await sessionManager.createSession({
          provider: 'google',
          userId: `user${i}`,
          email: `user${i}@test.com`,
          expiresAt: Date.now() + 3600000
        });
        sessions.push(sessionId);
      }
      
      // Retrieve all sessions to verify key consistency
      for (let i = 0; i < sessions.length; i++) {
        const retrieved = await sessionManager.getSession(sessions[i]);
        expect(retrieved).toBeDefined();
        expect(retrieved!.userId).toBe(`user${i}`);
      }
    });

    it('should handle missing encryption key gracefully', async () => {
      // Create a session manager with no encryption key
      const envWithoutKey = { ...mockEnv, SESSION_ENCRYPTION_KEY: '' };
      const managerWithoutKey = new SessionManager(envWithoutKey);
      
      // Attempting to create a session should fail
      await expect(managerWithoutKey.createSession({
        provider: 'google',
        userId: 'test',
        email: 'test@test.com',
        expiresAt: Date.now() + 3600000
      })).rejects.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle sessions created with different encryption keys as expired', async () => {
      // Simulate a session encrypted with a different key
      const differentKeyEnv = { ...mockEnv, SESSION_ENCRYPTION_KEY: 'different-key-that-is-32-bytes-long!!!!!!!!' };
      const differentKeyManager = new SessionManager(differentKeyEnv);
      
      // Create session with first manager
      const sessionId = await sessionManager.createSession({
        provider: 'google',
        userId: 'test-user',
        email: 'test@example.com',
        expiresAt: Date.now() + 3600000
      });
      
      // Try to retrieve with different key manager - should fail gracefully
      const retrieved = await differentKeyManager.getSession(sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should complete encryption/decryption within 50ms', async () => {
      const startTime = Date.now();
      
      const sessionData = {
        provider: 'google',
        userId: 'perf-test',
        email: 'perf@test.com',
        name: 'Performance Test User',
        picture: 'https://example.com/large-url-path.jpg',
        expiresAt: Date.now() + 3600000
      };
      
      // Create and retrieve session
      const sessionId = await sessionManager.createSession(sessionData);
      const retrieved = await sessionManager.getSession(sessionId);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(retrieved).toBeDefined();
      expect(duration).toBeLessThan(50);
    });

    it('should handle large session data efficiently', async () => {
      const largeData = {
        provider: 'google',
        userId: 'large-data-user',
        email: 'large@test.com',
        name: 'User with lots of data',
        // Add a large custom field (within reasonable limits)
        state: 'x'.repeat(1000),
        expiresAt: Date.now() + 3600000
      };
      
      const startTime = Date.now();
      const sessionId = await sessionManager.createSession(largeData);
      const retrieved = await sessionManager.getSession(sessionId);
      const duration = Date.now() - startTime;
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.state).toBe(largeData.state);
      expect(duration).toBeLessThan(50);
    });
  });
});