/**
 * Tests for OAuth session management functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeSessionId,
  getSessionId,
  clearSessionId,
  clearOAuthData
} from '../oauth-session';

describe('OAuth Session Management', () => {
  beforeEach(() => {
    // Clear session before each test
    clearOAuthData();
  });

  describe('storeSessionId', () => {
    it('should store session ID in memory', () => {
      const sessionId = 'test-session-123';
      storeSessionId(sessionId);
      
      expect(getSessionId()).toBe(sessionId);
    });

    it('should overwrite previous session ID', () => {
      storeSessionId('session-1');
      storeSessionId('session-2');
      
      expect(getSessionId()).toBe('session-2');
    });
  });

  describe('getSessionId', () => {
    it('should return null when no session ID is stored', () => {
      expect(getSessionId()).toBeNull();
    });

    it('should return the stored session ID', () => {
      const sessionId = 'test-session-456';
      storeSessionId(sessionId);
      
      expect(getSessionId()).toBe(sessionId);
    });
  });

  describe('clearSessionId', () => {
    it('should clear the stored session ID', () => {
      storeSessionId('test-session');
      clearSessionId();
      
      expect(getSessionId()).toBeNull();
    });

    it('should handle clearing when no session exists', () => {
      clearSessionId();
      expect(getSessionId()).toBeNull();
    });
  });

  describe('clearOAuthData', () => {
    it('should clear the session ID', () => {
      storeSessionId('test-session');
      clearOAuthData();
      
      expect(getSessionId()).toBeNull();
    });
  });
});