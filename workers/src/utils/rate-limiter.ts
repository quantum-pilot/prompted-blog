// @agent: cloudflare-backend
/**
 * Simple sliding window rate limiter for Cloudflare Workers
 * Tracks requests by IP address using KV storage
 */

export interface RateLimiterConfig {
  kv: KVNamespace;
  limit: number; // Max requests allowed
  windowMs: number; // Time window in milliseconds
  keyPrefix?: string; // Optional prefix for KV keys
}

export class RateLimiter {
  private kv: KVNamespace;
  private limit: number;
  private windowMs: number;
  private keyPrefix: string;

  constructor(config: RateLimiterConfig) {
    this.kv = config.kv;
    this.limit = config.limit;
    this.windowMs = config.windowMs;
    this.keyPrefix = config.keyPrefix || 'rate-limit';
  }

  /**
   * Check if a request is allowed based on the rate limit
   * @param key - Unique identifier (e.g., IP address)
   * @returns true if request is allowed, false if rate limit exceeded
   */
  async isAllowed(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const kvKey = `${this.keyPrefix}:${key}`;

    // Get current request data from KV
    const data = await this.kv.get(kvKey);

    if (data) {
      let requestData;
      try {
        requestData = JSON.parse(data);
      } catch {
        // Invalid data, reset
        await this.kv.delete(kvKey);
        return await this.recordRequest(kvKey, now);
      }

      // Filter out requests outside the current window
      const recentRequests = (requestData.requests || [])
        .filter((timestamp: number) => timestamp > windowStart);

      // Check if limit exceeded
      if (recentRequests.length >= this.limit) {
        return false;
      }

      // Add current request and update KV
      recentRequests.push(now);
      await this.kv.put(
        kvKey,
        JSON.stringify({ requests: recentRequests }),
        { expirationTtl: Math.ceil(this.windowMs / 1000) }
      );

      return true;
    } else {
      // First request in the window
      return await this.recordRequest(kvKey, now);
    }
  }

  /**
   * Get the client IP address from the request
   * @param request - The incoming request
   * @returns The client IP address
   */
  static getClientIp(request: Request): string {
    // CF-Connecting-IP is Cloudflare's header for the real client IP
    return request.headers.get('CF-Connecting-IP') ||
           request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
           'unknown';
  }

  /**
   * Record a new request
   */
  private async recordRequest(kvKey: string, timestamp: number): Promise<boolean> {
    await this.kv.put(
      kvKey,
      JSON.stringify({ requests: [timestamp] }),
      { expirationTtl: Math.ceil(this.windowMs / 1000) }
    );
    return true;
  }
}
