// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { sanitizeError } from '../error-sanitizer';

describe('error-sanitizer', () => {
  describe('sanitizeError', () => {
    it('should return generic message for null/undefined errors', () => {
      expect(sanitizeError(null, 'USER_CREATE')).toBe('USER_CREATE_FAILED');
      expect(sanitizeError(undefined, 'USER_UPDATE')).toBe('USER_UPDATE_FAILED');
    });

    it('should sanitize email addresses from error messages', () => {
      const error = new Error('User test@example.com not found');
      expect(sanitizeError(error, 'USER_RETRIEVE')).toBe('USER_RETRIEVE_FAILED');
    });

    it('should sanitize user IDs from error messages', () => {
      const error = new Error('User id: user_123abc456 does not exist');
      expect(sanitizeError(error, 'USER_LOOKUP')).toBe('USER_LOOKUP_FAILED');
    });

    it('should sanitize tokens from error messages', () => {
      const error = new Error('Invalid token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitizeError(error, 'AUTH')).toBe('AUTH_FAILED');
    });

    it('should sanitize API keys from error messages', () => {
      const error = new Error('API key sk_test_4242424242 is invalid');
      expect(sanitizeError(error, 'API_CALL')).toBe('API_CALL_FAILED');
    });

    it('should sanitize URLs with sensitive parameters', () => {
      const error = new Error('Failed to fetch https://api.example.com?key=secret123&user=test');
      expect(sanitizeError(error, 'FETCH')).toBe('FETCH_FAILED');
    });

    it('should handle known safe error types', () => {
      const error = new Error('Network timeout');
      expect(sanitizeError(error, 'NETWORK', { allowKnownErrors: true }))
        .toBe('NETWORK_FAILED: Network timeout');
    });

    it('should sanitize stack traces', () => {
      const error = new Error('Database error');
      error.stack = 'Error: Database error\n    at UserStorage.storeUser (/path/to/file.ts:42:13)';
      expect(sanitizeError(error, 'DB_OPERATION')).toBe('DB_OPERATION_FAILED');
    });

    it('should handle error objects with sensitive properties', () => {
      const error = {
        message: 'Operation failed',
        userId: 'user_123',
        email: 'test@example.com',
        token: 'secret_token'
      };
      expect(sanitizeError(error, 'OPERATION')).toBe('OPERATION_FAILED');
    });

    it('should preserve error codes when safe', () => {
      const error = new Error('Invalid input');
      (error as any).code = 'INVALID_INPUT';
      expect(sanitizeError(error, 'VALIDATION', { includeCode: true }))
        .toBe('VALIDATION_FAILED [INVALID_INPUT]');
    });

    it('should sanitize error codes with sensitive data', () => {
      const error = new Error('Failed');
      (error as any).code = 'USER_test@example.com_NOT_FOUND';
      expect(sanitizeError(error, 'LOOKUP', { includeCode: true }))
        .toBe('LOOKUP_FAILED');
    });

    it('should handle non-Error objects safely', () => {
      expect(sanitizeError('string error', 'OPERATION')).toBe('OPERATION_FAILED');
      expect(sanitizeError(123, 'OPERATION')).toBe('OPERATION_FAILED');
      expect(sanitizeError({}, 'OPERATION')).toBe('OPERATION_FAILED');
    });

    it('should handle circular references in error objects', () => {
      const error: any = { message: 'Circular error' };
      error.self = error;
      expect(sanitizeError(error, 'CIRCULAR')).toBe('CIRCULAR_FAILED');
    });
  });

  describe('performance', () => {
    it('should sanitize errors quickly', () => {
      const error = new Error('User test@example.com with token abc123 failed');
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        sanitizeError(error, 'PERF_TEST');
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50); // Should process 1000 errors in < 50ms
    });
  });
});