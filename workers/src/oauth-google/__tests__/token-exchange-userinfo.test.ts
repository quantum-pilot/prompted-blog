// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchUserInfo } from '../token-exchange';
import { mockGoogleUserInfoResponse } from './test-helpers';

describe('fetchUserInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user info successfully', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/pic.jpg',
    };

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockUser), { status: 200 })
    );

    const result = await fetchUserInfo('test-token');

    expect(result).toEqual(mockUser);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/oauth2/v1/userinfo',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token',
        },
      })
    );
  });

  it('should throw error on failed fetch', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    );

    await expect(fetchUserInfo('invalid-token')).rejects.toThrow(
      'Failed to fetch user info'
    );
  });

  it('should complete within 50ms (mocked)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      mockGoogleUserInfoResponse()
    );

    const start = performance.now();
    await fetchUserInfo('token');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });

  it('should handle user info with minimal fields', async () => {
    const minimalUser = { id: '123', email: 'user@example.com' };

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(minimalUser), { status: 200 })
    );

    const result = await fetchUserInfo('test-token');

    expect(result).toEqual(minimalUser);
    expect(result.id).toBe('123');
    expect(result.email).toBe('user@example.com');
  });

  it('should handle user info with all fields', async () => {
    const fullUser = {
      id: '123456789',
      email: 'user@example.com',
      name: 'Full Name',
      picture: 'https://example.com/photo.jpg',
      locale: 'en-US',
      verified_email: true,
    };

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(fullUser), { status: 200 })
    );

    const result = await fetchUserInfo('test-token');

    expect(result).toEqual(fullUser);
    expect(result.locale).toBe('en-US');
    expect(result.verified_email).toBe(true);
  });
});
