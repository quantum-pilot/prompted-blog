# SEC-003: High - Sensitive Data Exposed in URLs

## Severity: HIGH

## Affected File
`/workspace/workers/src/oauth-google/url-builder.ts`

## Description
User data is being passed as URL query parameters after authentication, which exposes sensitive information in multiple places including browser history, server logs, referrer headers, and potentially to third-party services.

## Current Implementation
```typescript
// In url-builder.ts line 43
export function buildCallbackRedirectUrl(userData: any, env: Env): string {
  const redirectUrl = new URL('/oauth/callback', getAppUrl(env));
  redirectUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)));
  // Results in: https://app.com/oauth/callback?user=%7B%22email%22%3A%22user%40example.com%22%2C%22name%22%3A%22John%20Doe%22%7D
  return redirectUrl.toString();
}
```

## Impact
- **Privacy Violation**: Personal data visible in browser history
- **Data Leakage**: Server access logs contain user PII
- **Referrer Exposure**: User data sent to external sites via referrer headers
- **Screenshot Risk**: Sensitive data visible in screenshots/recordings
- **Browser Extensions**: Third-party extensions can access URL parameters
- **GDPR Non-compliance**: Violates data minimization and protection principles

## Where Data Is Exposed
1. **Browser History**: Permanently stored unless cleared
2. **Server Logs**: Web servers, CDNs, load balancers log full URLs
3. **Analytics Tools**: Google Analytics, etc. capture URL parameters
4. **Browser Extensions**: Can read and store URL data
5. **Proxy Servers**: Corporate proxies log full URLs
6. **ISP Logs**: Internet service providers may log URLs
7. **Referrer Headers**: When navigating to external links

## Remediation Required

### Option 1: Use Encrypted Session Storage (Recommended)
```typescript
import { encrypt, generateSessionId } from './crypto';

export async function buildSecureRedirectUrl(userData: any, env: Env): Promise<string> {
  // Generate unique session ID
  const sessionId = generateSessionId();
  
  // Encrypt user data
  const encryptedData = await encrypt(
    JSON.stringify(userData),
    env.ENCRYPTION_KEY
  );
  
  // Store in KV with short TTL
  await env.SESSION_STORE.put(
    `session:${sessionId}`,
    encryptedData,
    { expirationTtl: 300 } // 5 minutes
  );
  
  // Only pass session ID in URL
  const redirectUrl = new URL('/oauth/callback', getAppUrl(env));
  redirectUrl.searchParams.set('session', sessionId);
  return redirectUrl.toString();
  // Results in: https://app.com/oauth/callback?session=abc123def456
}

// Retrieve data securely
export async function getUserDataFromSession(sessionId: string, env: Env): Promise<any> {
  const encryptedData = await env.SESSION_STORE.get(`session:${sessionId}`);
  if (!encryptedData) {
    throw new Error('Session expired or invalid');
  }
  
  // Delete after retrieval (one-time use)
  await env.SESSION_STORE.delete(`session:${sessionId}`);
  
  return JSON.parse(await decrypt(encryptedData, env.ENCRYPTION_KEY));
}
```

### Option 2: Use Secure HTTP-Only Cookies
```typescript
export function buildSecureRedirectWithCookie(userData: any, env: Env): Response {
  const redirectUrl = new URL('/oauth/callback', getAppUrl(env));
  
  // Encrypt user data
  const encryptedData = encrypt(JSON.stringify(userData), env.ENCRYPTION_KEY);
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl.toString(),
      'Set-Cookie': `auth_data=${encryptedData}; HttpOnly; Secure; SameSite=Strict; Max-Age=300; Path=/oauth`,
    },
  });
}
```

### Option 3: Use POST with Form Data
```typescript
export function buildPostRedirect(userData: any, env: Env): Response {
  const callbackUrl = new URL('/oauth/callback', getAppUrl(env)).toString();
  
  // Create auto-submitting form
  const html = `
    <html>
      <body>
        <form id="oauth-form" method="POST" action="${callbackUrl}">
          <input type="hidden" name="data" value="${encrypt(userData, env.ENCRYPTION_KEY)}">
        </form>
        <script>document.getElementById('oauth-form').submit();</script>
      </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

## Testing Requirements
- Verify no sensitive data appears in URLs
- Test session expiration and cleanup
- Validate encryption/decryption works correctly
- Ensure one-time use tokens can't be reused
- Check browser history doesn't contain PII

## Compliance Issues
- **GDPR Article 25**: Data protection by design and by default
- **GDPR Article 32**: Security of processing
- **CCPA**: Reasonable security procedures
- **PCI DSS**: If handling payment-related data
- **OWASP Top 10**: A01:2021 - Broken Access Control
- **CWE-598**: Use of GET Request Method with Sensitive Query Strings

## Priority
**HIGH** - Fix before production deployment

## References
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [RFC 6265 - HTTP Cookies](https://datatracker.ietf.org/doc/html/rfc6265)
- [GDPR Security Requirements](https://gdpr-info.eu/art-32-gdpr/)