/**
 * Contract Schema Tests
 * Verify Zod schemas validate correctly and provide proper type inference
 */

import { describe, it, expect } from 'vitest';
import {
  OAuthAuthorizeRequestSchema,
  OAuthCallbackRequestSchema,
  OAuthCallbackResponseSchema,
  SessionValidationResponseSchema,
  HealthCheckResponseSchema,
} from '../index';

describe('OAuth Contract Schemas', () => {
  describe('OAuthAuthorizeRequestSchema', () => {
    it('validates correct authorize request', () => {
      const valid = {
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        state: 'abc123_state_parameter_xyz789_secure',
        provider: 'google',
      };
      
      const result = OAuthAuthorizeRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
    
    it('rejects invalid provider', () => {
      const invalid = {
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        state: 'abc123_state_parameter_xyz789_secure',
        provider: 'facebook', // not supported
      };
      
      const result = OAuthAuthorizeRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
  
  describe('OAuthCallbackResponseSchema', () => {
    it('validates success response', () => {
      const success = {
        success: true,
        sessionId: 'session_abc123xyz789_secure_token',
        user: {
          email: 'user@example.com',
          name: 'John Doe',
          picture: 'https://example.com/avatar.jpg',
        },
      };
      
      const result = OAuthCallbackResponseSchema.safeParse(success);
      expect(result.success).toBe(true);
      if (result.success && result.data.success) {
        // TypeScript knows this is success type
        expect(result.data.sessionId).toBe('session_abc123xyz789_secure_token');
      }
    });
    
    it('validates error response', () => {
      const error = {
        success: false,
        error: 'invalid_grant',
        error_description: 'The provided authorization code is invalid',
      };
      
      const result = OAuthCallbackResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
      if (result.success && !result.data.success) {
        // TypeScript knows this is error type
        expect(result.data.error).toBe('invalid_grant');
      }
    });
  });
});

describe('Session Contract Schemas', () => {
  it('validates session response', () => {
    const session = {
      userId: 'user_123',
      email: 'user@example.com',
      provider: 'github',
      expiresAt: Date.now() + 3600000,
    };
    
    const result = SessionValidationResponseSchema.safeParse(session);
    expect(result.success).toBe(true);
  });
  
  it('validates session error', () => {
    const error = {
      error: 'session_not_found',
      error_description: 'Session has expired or does not exist',
    };
    
    const result = SessionValidationResponseSchema.safeParse(error);
    expect(result.success).toBe(true);
  });
});

describe('Health Contract Schemas', () => {
  it('validates health check response', () => {
    const health = {
      status: 'ok',
      timestamp: Date.now(),
    };
    
    const result = HealthCheckResponseSchema.safeParse(health);
    expect(result.success).toBe(true);
  });
});