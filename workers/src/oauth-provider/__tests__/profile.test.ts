// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUserProfile, standardizeUser } from '../profile';
import type { GoogleUserInfo, StandardizedUser } from '../../oauth-google/types';
import { RequestContext } from '../../utils/request-context';
import { AuditEventType } from '../../utils/audit-logger';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock RequestContext
const mockContext = {
  log: vi.fn(),
} as any as RequestContext;

describe('Profile Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchUserProfile', () => {
    const accessToken = 'mock_access_token';
    const mockGoogleUserInfo: GoogleUserInfo = {
      id: '12345',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      verified_email: true,
      given_name: 'Test',
      family_name: 'User',
      locale: 'en'
    };

    it('should fetch user profile successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGoogleUserInfo)
      });

      const result = await fetchUserProfile(accessToken, mockContext);

      expect(result).toEqual(mockGoogleUserInfo);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      expect(mockContext.log).toHaveBeenCalledWith(
        AuditEventType.API_CALL_SUCCESS,
        'success',
        expect.objectContaining({
          api: 'google_oauth',
          operation: 'fetch_user_profile',
          hasEmail: true,
          hasName: true
        })
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(fetchUserProfile(accessToken, mockContext)).rejects.toThrow(
        'Failed to fetch user profile'
      );

      expect(mockContext.log).toHaveBeenCalledWith(
        AuditEventType.API_CALL_FAILED,
        'failure',
        expect.objectContaining({
          api: 'google_oauth',
          operation: 'fetch_user_profile',
          status: 401,
          statusText: 'Unauthorized'
        })
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(fetchUserProfile(accessToken, mockContext)).rejects.toThrow(networkError);

      expect(mockContext.log).toHaveBeenCalledWith(
        AuditEventType.API_CALL_FAILED,
        'failure',
        expect.objectContaining({
          api: 'google_oauth',
          operation: 'fetch_user_profile',
          error: 'Network error',
          type: 'network_error'
        })
      );
    });

    it('should complete within latency budget', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGoogleUserInfo)
      });

      const start = Date.now();
      await fetchUserProfile(accessToken, mockContext);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('standardizeUser', () => {
    it('should transform GoogleUserInfo to StandardizedUser format', () => {
      const googleUserInfo: GoogleUserInfo = {
        id: '12345',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        verified_email: true,
        given_name: 'Test',
        family_name: 'User',
        locale: 'en'
      };

      const expected: StandardizedUser = {
        id: '12345',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        provider: 'google'
      };

      const result = standardizeUser(googleUserInfo);

      expect(result).toEqual(expected);
    });

    it('should handle minimal GoogleUserInfo', () => {
      const minimalGoogleUserInfo: GoogleUserInfo = {
        id: '67890',
        email: 'minimal@example.com',
        name: 'Minimal User',
        picture: 'https://example.com/default.jpg'
      };

      const expected: StandardizedUser = {
        id: '67890',
        email: 'minimal@example.com',
        name: 'Minimal User',
        picture: 'https://example.com/default.jpg',
        provider: 'google'
      };

      const result = standardizeUser(minimalGoogleUserInfo);

      expect(result).toEqual(expected);
    });
  });
});