/**
 * Tests for shared OAuth types with discriminated unions
 */

import { describe, it, expect } from 'vitest';
import type {
  OAuthAuthorizeResponse,
  OAuthCallbackResponse,
  SessionValidationResponse,
  ErrorResponse,
} from '@app/shared';
import {
  isErrorResponse,
  isOAuthCallbackSuccess,
} from '@app/shared';

describe('OAuth Types', () => {
  describe('Type Guards', () => {
    it('should identify error responses', () => {
      const error: ErrorResponse = {
        error: 'invalid_grant',
        error_description: 'Invalid authorization code'
      };
      
      expect(isErrorResponse(error)).toBe(true);
      expect(isErrorResponse({ success: true })).toBe(false);
      expect(isErrorResponse(null)).toBe(false);
      expect(isErrorResponse(undefined)).toBe(false);
    });

    it('should identify OAuth callback success', () => {
      const success = {
        success: true,
        sessionId: 'test-session-id'
      };
      
      const error = {
        success: false,
        error: 'invalid_grant'
      };
      
      expect(isOAuthCallbackSuccess(success)).toBe(true);
      expect(isOAuthCallbackSuccess(error)).toBe(false);
      expect(isOAuthCallbackSuccess({ success: true })).toBe(false);
    });
  });

  describe('Discriminated Unions', () => {
    it('should handle OAuth authorize responses', () => {
      const success: OAuthAuthorizeResponse = {
        success: true,
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?...'
      };
      
      const error: OAuthAuthorizeResponse = {
        success: false,
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      };
      
      // Type narrowing works
      if (success.success) {
        expect(success.authorizationUrl).toBeDefined();
      }
      
      if (!error.success) {
        expect(error.error).toBeDefined();
      }
    });

    it('should handle OAuth callback responses', () => {
      const success: OAuthCallbackResponse = {
        success: true,
        sessionId: 'session-123',
        user: {
          email: 'user@example.com',
          name: 'Test User'
        }
      };
      
      const error: OAuthCallbackResponse = {
        success: false,
        error: 'invalid_grant',
        error_description: 'Authorization code expired'
      };
      
      // Type narrowing works
      if (success.success) {
        expect(success.sessionId).toBeDefined();
        expect(success.user.email).toBeDefined();
      }
      
      if (!error.success) {
        expect(error.error).toBeDefined();
      }
    });
  });
});

// Import for error response test
import type { ErrorResponse } from '@app/shared/types';