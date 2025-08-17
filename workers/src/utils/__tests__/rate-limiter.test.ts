// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let mockKV: any;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    const kvStore = new Map<string, { value: string; expiry?: number }>();

    mockKV = {
      get: vi.fn(async (key: string) => {
        const item = kvStore.get(key);
        if (!item) return null;
        if (item.expiry && Date.now() > item.expiry) {
          kvStore.delete(key);
          return null;
        }
        return item.value;
      }),
      put: vi.fn(async (key: string, value: string, options?: any) => {
        const expiry = options?.expirationTtl
          ? Date.now() + (options.expirationTtl * 1000)
          : undefined;
        kvStore.set(key, { value, expiry });
      }),
      delete: vi.fn(async (key: string) => {
        kvStore.delete(key);
      })
    };

    rateLimiter = new RateLimiter({
      kv: mockKV,
      limit: 5,
      windowMs: 60000, // 1 minute
      keyPrefix: 'test'
    });
  });

  describe('isAllowed', () => {
    it('should allow first request', async () => {
      const allowed = await rateLimiter.isAllowed('test-ip');
      expect(allowed).toBe(true);
      expect(mockKV.put).toHaveBeenCalledWith(
        'test:test-ip',
        expect.any(String),
        expect.objectContaining({ expirationTtl: 60 })
      );
    });

    it('should allow requests up to the limit', async () => {
      const ip = 'test-ip-2';

      for (let i = 0; i < 5; i++) {
        const allowed = await rateLimiter.isAllowed(ip);
        expect(allowed).toBe(true);
      }

      // 6th request should be blocked
      const blocked = await rateLimiter.isAllowed(ip);
      expect(blocked).toBe(false);
    });

    it('should filter out old requests outside window', async () => {
      const ip = 'test-ip-3';
      const now = Date.now();

      // Mock stored data with old and new requests
      mockKV.get = vi.fn(async () => {
        return JSON.stringify({
          requests: [
            now - 70000, // Outside 1-minute window
            now - 65000, // Outside 1-minute window
            now - 30000, // Inside window
            now - 20000, // Inside window
            now - 10000  // Inside window
          ]
        });
      });

      // Should allow because only 3 requests are in the window
      const allowed = await rateLimiter.isAllowed(ip);
      expect(allowed).toBe(true);
    });

    it('should handle invalid stored data gracefully', async () => {
      const ip = 'test-ip-4';

      // Mock invalid JSON data
      mockKV.get = vi.fn(async () => 'invalid-json');

      const allowed = await rateLimiter.isAllowed(ip);
      expect(allowed).toBe(true);
      expect(mockKV.delete).toHaveBeenCalledWith('test:test-ip-4');
    });

    it('should set correct TTL on stored data', async () => {
      await rateLimiter.isAllowed('test-ip-5');

      expect(mockKV.put).toHaveBeenCalledWith(
        'test:test-ip-5',
        expect.any(String),
        { expirationTtl: 60 } // 60 seconds for 60000ms window
      );
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from CF-Connecting-IP header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'CF-Connecting-IP': '192.168.1.1'
        }
      });

      const ip = RateLimiter.getClientIp(request);
      expect(ip).toBe('192.168.1.1');
    });

    it('should throw error when CF-Connecting-IP is missing', () => {
      const request = new Request('http://localhost', {
        headers: {
          'X-Forwarded-For': '192.168.1.2, 10.0.0.1'
        }
      });

      expect(() => RateLimiter.getClientIp(request)).toThrow(
        'Security Error: CF-Connecting-IP header missing - this worker must be deployed to Cloudflare'
      );
    });

    it('should prefer CF-Connecting-IP over X-Forwarded-For', () => {
      const request = new Request('http://localhost', {
        headers: {
          'CF-Connecting-IP': '192.168.1.3',
          'X-Forwarded-For': '192.168.1.4'
        }
      });

      const ip = RateLimiter.getClientIp(request);
      expect(ip).toBe('192.168.1.3');
    });

    it('should throw error when no IP headers present', () => {
      const request = new Request('http://localhost');

      expect(() => RateLimiter.getClientIp(request)).toThrow(
        'Security Error: CF-Connecting-IP header missing - this worker must be deployed to Cloudflare'
      );
    });
  });

});
