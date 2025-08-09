# SEC-005: Medium - Missing Rate Limiting

## Severity: MEDIUM

## Affected Files
All OAuth endpoints in the oauth-google worker:
- `/oauth/google/authorize`
- `/oauth/google/callback`
- `/oauth/google/health`

## Description
The oauth-google worker has no rate limiting implementation, making it vulnerable to brute force attacks, denial of service (DoS) attacks, and resource exhaustion. Attackers could overwhelm the service with requests, attempt to guess state parameters, or exhaust API quotas.

## Current Implementation
```typescript
// No rate limiting checks in any handler
export async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  // Directly processes request without rate limit check
  const state = generateRandomString(32);
  await storeState(state, env);
  const authUrl = buildAuthorizationUrl(state, env);
  return Response.redirect(authUrl);
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  // No rate limiting before processing
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // ... continues processing
}
```

## Impact
- **Brute Force Attacks**: Attackers can repeatedly try to guess valid state parameters
- **DoS Attacks**: Service can be overwhelmed with requests, affecting legitimate users
- **Resource Exhaustion**: KV storage and API quotas can be exhausted
- **Cost Implications**: Excessive requests increase Cloudflare Workers usage costs
- **API Quota Exhaustion**: Google OAuth API quotas could be consumed by attackers
- **State Flooding**: Attackers could fill state storage with invalid entries

## Attack Scenarios
1. **State Parameter Brute Force**: Attempt millions of callbacks with different state values
2. **Authorization Flooding**: Generate thousands of authorization requests to fill state storage
3. **Token Exchange Abuse**: Repeatedly attempt token exchanges with invalid codes
4. **Distributed Attack**: Use multiple IPs to bypass simple IP-based limits

## Remediation Required

### 1. IP-Based Rate Limiting
```typescript
interface RateLimitConfig {
  requests: number;
  window: number; // seconds
  blockDuration: number; // seconds
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/oauth/google/authorize': { requests: 10, window: 60, blockDuration: 300 },
  '/oauth/google/callback': { requests: 5, window: 60, blockDuration: 600 },
  '/oauth/google/health': { requests: 30, window: 60, blockDuration: 60 },
};

export async function checkRateLimit(
  request: Request,
  path: string,
  env: Env
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const config = RATE_LIMITS[path];
  
  if (!config) {
    return { allowed: true }; // No limit configured
  }
  
  const key = `ratelimit:${path}:${ip}`;
  const blockKey = `blocked:${path}:${ip}`;
  
  // Check if IP is blocked
  const blocked = await env.RATE_LIMIT.get(blockKey);
  if (blocked) {
    const ttl = await env.RATE_LIMIT.getTTL(blockKey);
    return { allowed: false, retryAfter: ttl };
  }
  
  // Get current request count
  const current = await env.RATE_LIMIT.get(key);
  const count = current ? parseInt(current) : 0;
  
  if (count >= config.requests) {
    // Block the IP
    await env.RATE_LIMIT.put(blockKey, '1', {
      expirationTtl: config.blockDuration
    });
    return { allowed: false, retryAfter: config.blockDuration };
  }
  
  // Increment counter
  await env.RATE_LIMIT.put(key, String(count + 1), {
    expirationTtl: config.window
  });
  
  return { allowed: true };
}
```

### 2. User-Based Rate Limiting
```typescript
export async function checkUserRateLimit(
  userId: string,
  action: string,
  env: Env
): Promise<boolean> {
  const key = `user-limit:${action}:${userId}`;
  const limit = 3; // 3 OAuth attempts per hour per user
  const window = 3600; // 1 hour
  
  const attempts = await env.RATE_LIMIT.get(key);
  const count = attempts ? parseInt(attempts) : 0;
  
  if (count >= limit) {
    return false;
  }
  
  await env.RATE_LIMIT.put(key, String(count + 1), {
    expirationTtl: window
  });
  
  return true;
}
```

### 3. Sliding Window Rate Limiter
```typescript
export async function slidingWindowRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
  env: Env
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const key = `sliding:${identifier}`;
  
  // Get all timestamps in current window
  const data = await env.RATE_LIMIT.get(key);
  const timestamps: number[] = data ? JSON.parse(data) : [];
  
  // Filter timestamps within window
  const recentTimestamps = timestamps.filter(ts => ts > windowStart);
  
  if (recentTimestamps.length >= limit) {
    return false;
  }
  
  // Add current timestamp
  recentTimestamps.push(now);
  
  // Store updated timestamps
  await env.RATE_LIMIT.put(key, JSON.stringify(recentTimestamps), {
    expirationTtl: Math.ceil(windowMs / 1000)
  });
  
  return true;
}
```

### 4. Cloudflare Rate Limiting Rules
```typescript
// wrangler.toml configuration
export const rateLimitingRules = `
[[rate_limiting]]
threshold = 10
period = 60
action = "challenge"

[[rate_limiting]]
threshold = 50
period = 600
action = "block"
`;
```

### 5. Middleware Implementation
```typescript
export async function withRateLimit(
  request: Request,
  env: Env,
  handler: (req: Request, env: Env) => Promise<Response>
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Check rate limit
  const { allowed, retryAfter } = await checkRateLimit(request, path, env);
  
  if (!allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter || 60),
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + (retryAfter || 60) * 1000),
      },
    });
  }
  
  // Process request
  return handler(request, env);
}

// Usage in router
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  switch (url.pathname) {
    case '/oauth/google/authorize':
      return withRateLimit(request, env, handleAuthorize);
    case '/oauth/google/callback':
      return withRateLimit(request, env, handleCallback);
    default:
      return new Response('Not Found', { status: 404 });
  }
}
```

## Testing Requirements
- Test rate limits are enforced correctly
- Verify blocked IPs receive 429 responses
- Test retry-after header is set correctly
- Ensure legitimate users aren't affected
- Test distributed attack scenarios
- Verify rate limit data expires properly

## Monitoring
```typescript
// Log rate limit violations
export async function logRateLimitViolation(
  ip: string,
  path: string,
  env: Env
): Promise<void> {
  const timestamp = new Date().toISOString();
  const log = {
    type: 'rate_limit_violation',
    ip,
    path,
    timestamp,
  };
  
  // Send to monitoring service
  await fetch(env.MONITORING_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(log),
  });
}
```

## Compliance
- **OWASP Top 10**: A04:2021 - Insecure Design
- **CWE-307**: Improper Restriction of Excessive Authentication Attempts
- **CWE-770**: Allocation of Resources Without Limits

## Priority
**MEDIUM** - Should be implemented before production deployment

## References
- [OWASP Rate Limiting Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [RFC 6585 - 429 Too Many Requests](https://datatracker.ietf.org/doc/html/rfc6585#section-4)