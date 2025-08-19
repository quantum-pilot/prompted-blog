// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserStorage } from '../user-storage';
import { UserManager } from '../user-manager';
import type { RequestContext } from '../../utils/request-context';

describe('Error Sanitization Integration', () => {
  let mockEnv: any;
  let mockContext: RequestContext;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Mock console.error to capture logs
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create mock environment
    mockEnv = {
      JWT_SECRET: 'test-secret',
      OAUTH_SESSIONS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      },
      AUDIT_LOGS: {
        put: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
      },
    };

    // Create mock context
    mockContext = {
      requestId: 'test-request-id',
      userId: 'test-user',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      startTime: Date.now(),
      log: vi.fn(),
    };
  });

  describe('UserStorage error sanitization', () => {
    it('should not leak email in error logs when retrieval fails', async () => {
      const storage = new UserStorage(mockEnv);
      
      // Make KV get throw an error with email
      mockEnv.OAUTH_SESSIONS.get.mockRejectedValue(
        new Error('Failed to get user:email:sensitive@example.com')
      );

      await storage.retrieveUserByEmail('sensitive@example.com', mockContext);

      // Check that console.error was called with sanitized message
      expect(consoleErrorSpy).toHaveBeenCalledWith('USER_RETRIEVE_BY_EMAIL_FAILED');
      
      // Verify sensitive email is not in any console.error calls
      const calls = consoleErrorSpy.mock.calls;
      for (const call of calls) {
        expect(call.join(' ')).not.toContain('sensitive@example.com');
      }
    });

    it('should not leak user ID in error logs when retrieval fails', async () => {
      const storage = new UserStorage(mockEnv);
      
      // Make KV get throw an error with user ID
      mockEnv.OAUTH_SESSIONS.get.mockRejectedValue(
        new Error('User user_secret123abc not found in KV store')
      );

      await storage.retrieveUserById('user_secret123abc', mockContext);

      // Check that console.error was called with sanitized message
      expect(consoleErrorSpy).toHaveBeenCalledWith('USER_RETRIEVE_BY_ID_FAILED');
      
      // Verify sensitive ID is not in any console.error calls
      const calls = consoleErrorSpy.mock.calls;
      for (const call of calls) {
        expect(call.join(' ')).not.toContain('user_secret123abc');
      }
    });

    it('should not leak validation errors with sensitive data', async () => {
      const storage = new UserStorage(mockEnv);
      
      const invalidUser = {
        id: 'user_123',
        email: 'invalid', // Invalid email that might be logged
        name: 'Test User',
        metadata: {},
      } as any;

      try {
        await storage.storeUser(invalidUser, mockContext);
      } catch {
        // Expected to throw
      }

      // Check that validation error doesn't leak details
      expect(consoleErrorSpy).toHaveBeenCalledWith('USER_STORE_VALIDATION_FAILED');
      
      // Verify no sensitive data in logs
      const calls = consoleErrorSpy.mock.calls;
      for (const call of calls) {
        const logMessage = call.join(' ');
        expect(logMessage).not.toContain('invalid');
        expect(logMessage).not.toContain('user_123');
      }
    });
  });

  describe('UserManager error sanitization', () => {
    it('should not leak email in audit logs when user creation fails', async () => {
      const manager = new UserManager(mockEnv);
      
      // Make storage throw an error
      mockEnv.OAUTH_SESSIONS.put.mockRejectedValue(
        new Error('KV store error for email secret@example.com')
      );

      try {
        await manager.createUser('secret@example.com', 'google', mockContext);
      } catch {
        // Expected to throw
      }

      // Check console.error was sanitized
      expect(consoleErrorSpy).toHaveBeenCalledWith('USER_CREATE_FAILED');
      
      // Check audit log doesn't contain email
      expect(mockContext.log).toHaveBeenCalledWith(
        expect.any(String),
        'failure',
        expect.objectContaining({
          provider: 'google',
          errorType: 'USER_CREATE_FAILED',
        })
      );
      
      // Verify email is not in audit log
      const auditCalls = (mockContext.log as any).mock.calls;
      for (const call of auditCalls) {
        expect(JSON.stringify(call)).not.toContain('secret@example.com');
      }
    });

    it('should sanitize errors in findOrCreateUser', async () => {
      const manager = new UserManager(mockEnv);
      
      // Make storage throw an error with token
      mockEnv.OAUTH_SESSIONS.get.mockRejectedValue(
        new Error('Invalid token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature')
      );

      try {
        await manager.findOrCreateUser(
          'test@example.com',
          'github',
          mockContext,
          'Test User'
        );
      } catch {
        // Expected to throw
      }

      // Check console.error was sanitized
      expect(consoleErrorSpy).toHaveBeenCalledWith('USER_FIND_OR_CREATE_FAILED');
      
      // Verify no JWT token in logs
      const calls = consoleErrorSpy.mock.calls;
      for (const call of calls) {
        expect(call.join(' ')).not.toContain('eyJ');
      }
    });
  });

  describe('Performance', () => {
    it('should handle errors without significant latency', async () => {
      const storage = new UserStorage(mockEnv);
      
      // Create error with lots of sensitive data
      const complexError = new Error(
        'User test@example.com with ID user_123456789 and token Bearer abc123def456 failed at https://api.example.com?key=secret'
      );
      
      mockEnv.OAUTH_SESSIONS.get.mockRejectedValue(complexError);

      const start = performance.now();
      
      // Run multiple operations that will trigger error sanitization
      for (let i = 0; i < 10; i++) {
        await storage.retrieveUserByEmail(`test${i}@example.com`, mockContext);
      }
      
      const duration = performance.now() - start;
      
      // Should handle 10 error sanitizations in under 50ms
      expect(duration).toBeLessThan(50);
    });
  });
});