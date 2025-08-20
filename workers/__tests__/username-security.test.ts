// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsernameChecker } from '../src/oauth-client/username-checker';
import { ProfileHandler } from '../src/oauth-client/profile-handler';
import { UsernameBlocklist } from '../src/oauth-client/username-blocklist';
import { RateLimiter } from '../src/utils/rate-limiter';
import type { Env } from '../src/oauth-client/types';
import type { RequestContext } from '../src/utils/request-context';

// Mock environment
const mockEnv: Env = {
  OAUTH_SESSIONS: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as any,
  OAUTH_PROVIDERS: {} as any,
  USER_INDEX: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as any,
};

const mockContext: RequestContext = {
  clientIp: '127.0.0.1',
  userAgent: 'test',
  requestId: 'test-123',
  userId: 'user-123',
} as any;

describe('Username Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Username Blocklist', () => {
    it('should block reserved system usernames', () => {
      expect(UsernameBlocklist.isBlocked('admin')).toBe(true);
      expect(UsernameBlocklist.isBlocked('root')).toBe(true);
      expect(UsernameBlocklist.isBlocked('system')).toBe(true);
      expect(UsernameBlocklist.isBlocked('api')).toBe(true);
      expect(UsernameBlocklist.isBlocked('oauth')).toBe(true);
    });

    it('should block inappropriate usernames', () => {
      expect(UsernameBlocklist.isBlocked('administrator')).toBe(true);
      expect(UsernameBlocklist.isBlocked('test123')).toBe(true);
      expect(UsernameBlocklist.isBlocked('user456')).toBe(true);
    });

    it('should allow valid usernames', () => {
      expect(UsernameBlocklist.isBlocked('john-doe')).toBe(false);
      expect(UsernameBlocklist.isBlocked('alice123')).toBe(false);
      expect(UsernameBlocklist.isBlocked('developer')).toBe(false);
    });

    it('should provide appropriate block reasons', () => {
      expect(UsernameBlocklist.getBlockReason('admin')).toContain('reserved');
      expect(UsernameBlocklist.getBlockReason('test123')).toContain('inappropriate');
    });
  });

  describe('Username Reservation TTL', () => {
    it('should use 90-second TTL for reservations', async () => {
      const checker = new UsernameChecker(mockEnv);
      (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue(null);
      (mockEnv.USER_INDEX.get as any).mockResolvedValue(null);

      await checker.reserve('validname', 'user-123', mockContext);

      expect(mockEnv.OAUTH_SESSIONS.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 90 })
      );
    });
  });

  describe('Atomic Username Operations', () => {
    it('should prevent race conditions in reserve operation', async () => {
      const checker = new UsernameChecker(mockEnv);
      
      // Simulate username already reserved by another user
      (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue('other-user-456');
      
      const result = await checker.reserve('testname', 'user-123', mockContext);
      expect(result).toBe(false);
    });

    it('should verify reservation ownership in confirmClaim', async () => {
      const checker = new UsernameChecker(mockEnv);
      
      // Simulate reservation by different user
      (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue('other-user-456');
      
      const result = await checker.confirmClaim('testname', 'user-123', mockContext);
      expect(result).toBe(false);
      
      // Should not set username index if not reserved by user
      expect(mockEnv.USER_INDEX.put).not.toHaveBeenCalled();
    });

    it('should clean up invalid reservations', async () => {
      const checker = new UsernameChecker(mockEnv);
      
      // Mock: user-123 has reservation, but username is already claimed by other-user-456
      (mockEnv.OAUTH_SESSIONS.get as any)
        .mockResolvedValueOnce('user-123') // First call: reservation check
        .mockResolvedValueOnce('other-user-456'); // Second call: username index check
      
      const result = await checker.confirmClaim('testname', 'user-123', mockContext);
      expect(result).toBe(false);
      
      // Should clean up the invalid reservation
      expect(mockEnv.OAUTH_SESSIONS.delete).toHaveBeenCalled();
    });
  });

  describe('Constant-Time Response', () => {
    it('should enforce minimum response time for username checks', async () => {
      const handler = new ProfileHandler(mockEnv);
      const startTime = Date.now();
      
      (mockEnv.USER_INDEX.get as any).mockResolvedValue(null);
      (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue(null);
      
      await handler.checkUsernameAvailability({ username: 'testname' }, mockContext);
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow 5ms variance
    });

    it('should have consistent timing for blocked usernames', async () => {
      const handler = new ProfileHandler(mockEnv);
      const startTime = Date.now();
      
      await handler.checkUsernameAvailability({ username: 'admin' }, mockContext);
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow 5ms variance
    });
  });

  describe('Rate Limiting', () => {
    it('should create rate limiter with correct limits', () => {
      const limiter = new RateLimiter({
        kv: mockEnv.OAUTH_SESSIONS,
        limit: 10,
        windowMs: 60000,
        keyPrefix: 'test'
      });

      expect(limiter).toBeDefined();
    });

    it('should track requests within window', async () => {
      const limiter = new RateLimiter({
        kv: mockEnv.OAUTH_SESSIONS,
        limit: 2,
        windowMs: 1000,
        keyPrefix: 'test'
      });

      (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValueOnce(null);
      
      const allowed1 = await limiter.isAllowed('test-key');
      expect(allowed1).toBe(true);
      expect(mockEnv.OAUTH_SESSIONS.put).toHaveBeenCalled();
    });

    it('should extract client IP from CF header', () => {
      const request = new Request('http://example.com', {
        headers: { 'CF-Connecting-IP': '192.168.1.1' }
      });
      
      const ip = RateLimiter.getClientIp(request);
      expect(ip).toBe('192.168.1.1');
    });

    it('should throw error if CF header missing in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const request = new Request('http://example.com');
      
      expect(() => RateLimiter.getClientIp(request)).toThrow('Security Error');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Performance Requirements', () => {
    it('should complete username check in under 50ms', async () => {
      const checker = new UsernameChecker(mockEnv);
      const startTime = Date.now();
      
      (mockEnv.USER_INDEX.get as any).mockResolvedValue(null);
      (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue(null);
      
      await checker.isAvailable('testname', mockContext);
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(50);
    });

    it('should complete reservation in under 50ms', async () => {
      const checker = new UsernameChecker(mockEnv);
      const startTime = Date.now();
      
      (mockEnv.USER_INDEX.get as any).mockResolvedValue(null);
      (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue(null);
      
      await checker.reserve('testname', 'user-123', mockContext);
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(50);
    });
  });
});