/**
 * Tests for OAuth session management functions
 * Now focused on cookie-based sessions (no in-memory session ID storage)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateSessionWithWorker
} from '../oauth-session';
import { createHonoClient } from '../hono-client';

// Mock the hono client
vi.mock('../hono-client', () => ({
  createHonoClient: vi.fn()
}));

describe('OAuth Session Management', () => {
  let mockHonoClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock Hono client
    mockHonoClient = {
      oauth: {
        session: {
          $get: vi.fn()
        }
      }
    };
    
    vi.mocked(createHonoClient).mockReturnValue(mockHonoClient);
  });

  describe('validateSessionWithWorker', () => {
    it('should validate session using cookies (no sessionId parameter needed)', async () => {
      const workerUrl = 'http://localhost:8787';
      const mockSession = {
        provider: 'google',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
        expiresAt: Date.now() + 3600000
      };
      
      mockHonoClient.oauth.session.$get.mockResolvedValue({
        ok: true,
        json: async () => ({
          provider: mockSession.provider,
          email: mockSession.email,
          name: mockSession.name,
          picture: mockSession.picture,
          expiresAt: mockSession.expiresAt
        })
      });
      
      const result = await validateSessionWithWorker(workerUrl);
      
      expect(result).toEqual(mockSession);
      expect(mockHonoClient.oauth.session.$get).toHaveBeenCalledWith(
        {},
        {}
      );
      expect(createHonoClient).toHaveBeenCalledWith(workerUrl);
    });

    it('should return null when session is invalid', async () => {
      const workerUrl = 'http://localhost:8787';
      
      mockHonoClient.oauth.session.$get.mockResolvedValue({
        ok: false
      });
      
      const result = await validateSessionWithWorker(workerUrl);
      
      expect(result).toBeNull();
    });

    it('should return null when response contains error', async () => {
      const workerUrl = 'http://localhost:8787';
      
      mockHonoClient.oauth.session.$get.mockResolvedValue({
        ok: true,
        json: async () => ({
          error: 'session_expired',
          error_description: 'Session has expired'
        })
      });
      
      const result = await validateSessionWithWorker(workerUrl);
      
      expect(result).toBeNull();
    });
  });
});