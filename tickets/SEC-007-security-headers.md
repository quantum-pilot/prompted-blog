# SEC-007: Low - Missing Security Headers

## Severity: LOW

## Affected Files
All response handlers in the oauth-google worker

## Description
The oauth-google worker responses lack important security headers that provide defense-in-depth against various attacks including XSS, clickjacking, MIME-sniffing, and other client-side vulnerabilities. While not directly exploitable, missing security headers reduce the application's overall security posture.

## Current Implementation
```typescript
// Current responses have minimal headers
return new Response(JSON.stringify(data), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    // No security headers
  },
});
```

## Missing Headers and Their Impact

### 1. **X-Content-Type-Options: nosniff**
- **Purpose**: Prevents browsers from MIME-sniffing responses
- **Risk Without**: Browsers might interpret files as different MIME types, leading to XSS

### 2. **X-Frame-Options: DENY**
- **Purpose**: Prevents the page from being embedded in iframes
- **Risk Without**: Clickjacking attacks where the OAuth flow is embedded in malicious sites

### 3. **X-XSS-Protection: 1; mode=block**
- **Purpose**: Enables browser's XSS filter
- **Risk Without**: Reduced protection against reflected XSS attacks

### 4. **Strict-Transport-Security**
- **Purpose**: Forces HTTPS connections
- **Risk Without**: Man-in-the-middle attacks via protocol downgrade

### 5. **Content-Security-Policy**
- **Purpose**: Controls resource loading and script execution
- **Risk Without**: XSS and data injection attacks

### 6. **Referrer-Policy**
- **Purpose**: Controls referrer information sent with requests
- **Risk Without**: Sensitive URLs leaked to third parties

### 7. **Permissions-Policy**
- **Purpose**: Controls browser features and APIs
- **Risk Without**: Unauthorized access to browser capabilities

## Remediation Required

### 1. Security Headers Configuration
```typescript
export const SECURITY_HEADERS: HeadersInit = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Enable XSS filter
  'X-XSS-Protection': '1; mode=block',
  
  // Force HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://oauth2.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
  
  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
  ].join(', '),
};
```

### 2. Response Helper with Security Headers
```typescript
export class SecureResponse {
  static json(
    data: any,
    status: number = 200,
    additionalHeaders: HeadersInit = {}
  ): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS,
        ...additionalHeaders,
      },
    });
  }
  
  static redirect(
    url: string,
    status: number = 302,
    additionalHeaders: HeadersInit = {}
  ): Response {
    return new Response(null, {
      status,
      headers: {
        'Location': url,
        ...SECURITY_HEADERS,
        ...additionalHeaders,
      },
    });
  }
  
  static error(
    message: string,
    status: number = 400,
    additionalHeaders: HeadersInit = {}
  ): Response {
    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...SECURITY_HEADERS,
          ...additionalHeaders,
        },
      }
    );
  }
  
  static html(
    content: string,
    status: number = 200,
    additionalHeaders: HeadersInit = {}
  ): Response {
    return new Response(content, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...SECURITY_HEADERS,
        ...additionalHeaders,
      },
    });
  }
}
```

### 3. Environment-Specific Headers
```typescript
export function getSecurityHeaders(env: Env): HeadersInit {
  const baseHeaders = { ...SECURITY_HEADERS };
  
  // Adjust CSP for development
  if (env.ENVIRONMENT === 'development') {
    baseHeaders['Content-Security-Policy'] = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' http://localhost:* https://oauth2.googleapis.com",
    ].join('; ');
  }
  
  // Add CORS headers if needed
  if (env.ENABLE_CORS) {
    baseHeaders['Access-Control-Allow-Origin'] = env.ALLOWED_ORIGIN;
    baseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    baseHeaders['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  
  return baseHeaders;
}
```

### 4. Middleware Pattern for Headers
```typescript
export async function withSecurityHeaders(
  handler: (request: Request, env: Env) => Promise<Response>,
  request: Request,
  env: Env
): Promise<Response> {
  const response = await handler(request, env);
  
  // Clone response to modify headers
  const newResponse = new Response(response.body, response);
  
  // Add security headers
  Object.entries(getSecurityHeaders(env)).forEach(([key, value]) => {
    newResponse.headers.set(key, value as string);
  });
  
  return newResponse;
}

// Usage in router
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  return withSecurityHeaders(async (req, env) => {
    const url = new URL(req.url);
    
    switch (url.pathname) {
      case '/oauth/google/authorize':
        return handleAuthorize(req, env);
      case '/oauth/google/callback':
        return handleCallback(req, env);
      default:
        return SecureResponse.error('Not Found', 404);
    }
  }, request, env);
}
```

### 5. Updated Handler Implementation
```typescript
export async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  const state = generateRandomString(32);
  await storeState(state, env);
  const authUrl = buildAuthorizationUrl(state, env);
  
  return SecureResponse.redirect(authUrl);
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  try {
    // ... validation logic ...
    
    const userData = await getUserData(tokens.access_token);
    
    return SecureResponse.json({
      success: true,
      user: userData,
    });
    
  } catch (error) {
    return SecureResponse.error('Authentication failed', 401);
  }
}
```

### 6. CSP Nonce for Inline Scripts (if needed)
```typescript
export function generateCSPNonce(): string {
  return crypto.randomUUID();
}

export function getCSPWithNonce(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    // ... other directives
  ].join('; ');
}

// Usage with inline scripts
export function renderCallbackPage(data: any, env: Env): Response {
  const nonce = generateCSPNonce();
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth Callback</title>
      </head>
      <body>
        <script nonce="${nonce}">
          window.opener.postMessage(${JSON.stringify(data)}, '${env.APP_URL}');
          window.close();
        </script>
      </body>
    </html>
  `;
  
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': getCSPWithNonce(nonce),
      ...SECURITY_HEADERS,
    },
  });
}
```

## Testing Requirements
- Verify all responses include security headers
- Test CSP doesn't break functionality
- Ensure CORS works correctly with security headers
- Validate frame-ancestors prevents embedding
- Test HSTS header is present on HTTPS responses
- Verify nonce-based CSP works for inline scripts

## Browser Compatibility
Most security headers are widely supported:
- **X-Content-Type-Options**: All modern browsers
- **X-Frame-Options**: All modern browsers (use CSP frame-ancestors for newer browsers)
- **HSTS**: All modern browsers
- **CSP**: Check specific directives at [caniuse.com](https://caniuse.com/contentsecuritypolicy)

## Monitoring
```typescript
// Log CSP violations
export function setupCSPReporting(env: Env): string {
  return `report-uri ${env.CSP_REPORT_ENDPOINT}; report-to csp-endpoint`;
}

// Add Report-To header
export const REPORTING_HEADERS = {
  'Report-To': JSON.stringify({
    group: 'csp-endpoint',
    max_age: 10886400,
    endpoints: [{ url: 'https://your-app.com/csp-reports' }],
  }),
};
```

## Compliance
- **OWASP Secure Headers Project**: Best practices for HTTP security headers
- **PCI DSS**: Requirement 6.5 - Address common vulnerabilities
- **NIST**: Security and Privacy Controls

## Priority
**LOW** - Important for defense-in-depth but not blocking deployment

## References
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [SecurityHeaders.com](https://securityheaders.com/)