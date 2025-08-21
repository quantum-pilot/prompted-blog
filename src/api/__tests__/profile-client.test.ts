import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileClient } from '../profile-client';
import { createHonoClient } from '../hono-client';

vi.mock('../hono-client', () => ({
  createHonoClient: vi.fn(),
}));

describe('ProfileClient', () => {
  let client: ProfileClient;
  let mockApi: any;
  const mockUser = { id: 'u1', email: 'test@test.com', provider: 'google' as const, username: 'test', createdAt: 1, updatedAt: 1 };

  beforeEach(() => {
    mockApi = {
      api: {
        profile: { $get: vi.fn(), $put: vi.fn() },
        username: { check: new Proxy({}, { get: () => ({ $get: vi.fn() }) }) },
      },
    };
    (createHonoClient as any).mockReturnValue(mockApi);
    client = new ProfileClient('http://localhost:8787');
  });

  describe('getProfile', () => {
    it('gets profile using cookies', async () => {
      mockApi.api.profile.$get.mockResolvedValue({ ok: true, json: async () => ({ success: true, user: mockUser }) });
      const result = await client.getProfile();
      expect(result).toEqual({ success: true, user: mockUser });
      expect(mockApi.api.profile.$get).toHaveBeenCalledWith({}, {});
    });

    it('handles unauthorized response', async () => {
      mockApi.api.profile.$get.mockResolvedValue({ 
        ok: true, 
        json: async () => ({ success: false, error: 'unauthorized', error_description: 'No valid session' })
      });
      const result = await client.getProfile();
      expect(result.success).toBe(false);
      expect(result.error).toBe('unauthorized');
    });

    it('handles errors', async () => {
      mockApi.api.profile.$get.mockRejectedValue(new Error('Network'));
      const result = await client.getProfile();
      expect(result.success).toBe(false);
      expect(result.error).toBe('internal_error');
    });
  });

  describe('updateProfile', () => {
    it('updates username using cookies', async () => {
      mockApi.api.profile.$put.mockResolvedValue({ ok: true, json: async () => ({ success: true, user: { ...mockUser, username: 'new' } }) });
      const result = await client.updateProfile('new');
      expect(result.success).toBe(true);
      expect(mockApi.api.profile.$put).toHaveBeenCalledWith({ json: { username: 'new' } }, {});
    });

    it('handles unauthorized response', async () => {
      mockApi.api.profile.$put.mockResolvedValue({ 
        ok: true, 
        json: async () => ({ success: false, error: 'profile_update_failed', error_description: 'Unauthorized' })
      });
      const result = await client.updateProfile('new');
      expect(result.success).toBe(false);
      expect(result.error).toBe('profile_update_failed');
    });

    it('handles errors', async () => {
      mockApi.api.profile.$put.mockRejectedValue(new Error('Network'));
      const result = await client.updateProfile('new');
      expect(result.success).toBe(false);
      expect(result.error).toBe('profile_update_failed');
    });
  });

  describe('checkUsernameAvailability', () => {
    it('checks available username', async () => {
      const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, available: true }) });
      mockApi.api.username.check = new Proxy({}, { get: () => ({ $get: mock }) });
      const result = await client.checkUsernameAvailability('new');
      expect(result).toEqual({ success: true, available: true });
      expect(mock).toHaveBeenCalledWith({ param: { username: 'new' } });
    });

    it('handles errors', async () => {
      const mock = vi.fn().mockRejectedValue(new Error('Network'));
      mockApi.api.username.check = new Proxy({}, { get: () => ({ $get: mock }) });
      const result = await client.checkUsernameAvailability('new');
      expect(result.success).toBe(false);
      expect(result.error).toBe('username_invalid');
    });
  });

  it('uses default URL', () => {
    new ProfileClient();
    expect(createHonoClient).toHaveBeenCalledWith(expect.any(String));
  });
});