import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHonoClient, getAuthHeaders } from '../hono-client';
import type { InferRequestType, InferResponseType } from 'hono/client';
import type { AppType } from '../../../workers/src/index';

// Mock the hono/client module
vi.mock('hono/client', () => ({
  hc: vi.fn((url: string, options: any) => {
    // Return a mock client that captures the URL and options
    return {
      _url: url,
      _options: options,
      oauth: {
        callback: {
          $post: vi.fn(),
        },
        session: {
          $get: vi.fn(),
        },
      },
    };
  }),
}));

describe('Hono Client', () => {
  describe('createHonoClient', () => {
    it('should create a client with the correct URL', () => {
      const workerUrl = 'https://worker.example.com';
      const client = createHonoClient(workerUrl);
      
      expect(client).toBeDefined();
      expect((client as any)._url).toBe(workerUrl);
    });

    it('should configure client with correct options', () => {
      const workerUrl = 'https://worker.example.com';
      const client = createHonoClient(workerUrl);
      
      const options = (client as any)._options;
      expect(options.init.credentials).toBe('include');
      expect(options.init.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('getAuthHeaders', () => {
    it('should create correct authorization headers', () => {
      const sessionId = 'test-session-123';
      const headers = getAuthHeaders(sessionId);
      
      expect(headers['Authorization']).toBe(`Bearer ${sessionId}`);
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Type Safety', () => {
    it('should have correct type inference for OAuth callback', () => {
      // This test verifies that TypeScript types are correctly inferred
      // The actual runtime behavior is tested in oauth-client.test.ts
      
      type CallbackRequest = InferRequestType<AppType['oauth']['callback']['$post']>;
      type CallbackResponse = InferResponseType<AppType['oauth']['callback']['$post']>;
      
      // These type assertions ensure our types are correct at compile time
      const request: CallbackRequest = {
        json: {
          code: 'test-code',
          state: 'test-state',
          code_verifier: 'test-verifier',
          provider: 'google' as const,
        },
      };
      
      // TypeScript will verify these types match the worker's expected types
      expect(request).toBeDefined();
      expect(request.json).toHaveProperty('code');
      expect(request.json).toHaveProperty('state');
      expect(request.json).toHaveProperty('code_verifier');
      expect(request.json).toHaveProperty('provider');
    });

    it('should have correct type inference for session validation', () => {
      // This test verifies that TypeScript types are correctly inferred
      // The actual runtime behavior is tested in oauth-session.test.ts
      
      type SessionRequest = InferRequestType<AppType['oauth']['session']['$get']>;
      type SessionResponse = InferResponseType<AppType['oauth']['session']['$get']>;
      
      // Session endpoint doesn't take query params, only headers
      const headers = getAuthHeaders('test-session');
      
      expect(headers).toBeDefined();
      expect(headers['Authorization']).toContain('Bearer');
    });
  });
});