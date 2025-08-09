# SEC-004: High - Insufficient Input Validation

## Severity: HIGH

## Affected Files
- `/workspace/workers/src/oauth-google/handlers.ts`
- `/workspace/workers/src/oauth-google/router.ts`

## Description
The oauth-google worker accepts and processes user input without proper validation, including OAuth state parameters, authorization codes, and URLs. This lack of validation could lead to various injection attacks, application crashes, or security bypasses.

## Current Implementation
```typescript
// In handlers.ts lines 38-47
export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');  // No validation
  const state = url.searchParams.get('state'); // No validation
  
  if (!code || !state) {
    return errorResponse('Missing required parameters');
  }
  
  // Directly uses unvalidated input
  const isValidState = await validateState(state, env);
  const tokens = await exchangeCodeForTokens(code, env);
}

// In router.ts lines 15-23
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url); // No URL validation
  const pathname = url.pathname;    // No path validation
  
  // Routes without input sanitization
  if (pathname === '/oauth/google/authorize') {
    return handleAuthorize(request, env);
  }
}
```

## Impact
- **Injection Attacks**: Malformed inputs could lead to command or script injection
- **Application Crashes**: Invalid inputs might cause runtime errors
- **Security Bypass**: Crafted inputs could bypass security checks
- **Buffer Overflow**: Oversized inputs without length limits
- **Path Traversal**: Unvalidated URLs could access unintended endpoints
- **State Fixation**: Predictable or malformed state parameters
- **DoS Attacks**: Resource exhaustion through malicious input

## Attack Vectors
1. **Malformed Authorization Codes**: Could cause API errors or bypasses
2. **State Parameter Manipulation**: CSRF attacks or session hijacking
3. **URL Injection**: Redirect to malicious sites
4. **Oversized Parameters**: Memory exhaustion
5. **Special Characters**: Break parsing or cause injection

## Remediation Required

### 1. State Parameter Validation
```typescript
const STATE_PATTERN = /^[A-Za-z0-9\-._~]{32,128}$/;

export function validateStateFormat(state: string): boolean {
  // Check format
  if (!STATE_PATTERN.test(state)) {
    return false;
  }
  
  // Check length
  if (state.length < 32 || state.length > 128) {
    return false;
  }
  
  return true;
}
```

### 2. Authorization Code Validation
```typescript
const AUTH_CODE_PATTERN = /^[A-Za-z0-9\-._~\/]{20,256}$/;

export function validateAuthCode(code: string): boolean {
  // Google auth codes have specific format
  if (!AUTH_CODE_PATTERN.test(code)) {
    return false;
  }
  
  // Additional Google-specific validation
  if (!code.startsWith('4/') && !code.startsWith('4-')) {
    return false; // Google codes typically start with 4/ or 4-
  }
  
  return true;
}
```

### 3. URL Validation
```typescript
const ALLOWED_PATHS = [
  '/oauth/google/authorize',
  '/oauth/google/callback',
  '/oauth/google/health',
];

export function validateRequestUrl(url: URL): boolean {
  // Validate protocol
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false;
  }
  
  // Validate path
  if (!ALLOWED_PATHS.includes(url.pathname)) {
    return false;
  }
  
  // Validate no path traversal
  if (url.pathname.includes('..') || url.pathname.includes('//')) {
    return false;
  }
  
  return true;
}
```

### 4. Comprehensive Input Sanitization
```typescript
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  // Trim and limit length
  let sanitized = input.trim().substring(0, maxLength);
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Encode HTML entities to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return sanitized;
}
```

### 5. Complete Handler with Validation
```typescript
export async function handleCallback(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    
    // Validate URL structure
    if (!validateRequestUrl(url)) {
      return errorResponse('Invalid request URL', 400);
    }
    
    // Get and validate parameters
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code || !state) {
      return errorResponse('Missing required parameters', 400);
    }
    
    // Validate state format
    if (!validateStateFormat(state)) {
      return errorResponse('Invalid state parameter', 400);
    }
    
    // Validate authorization code
    if (!validateAuthCode(code)) {
      return errorResponse('Invalid authorization code', 400);
    }
    
    // Additional security: Check state hasn't been used
    const stateUsed = await env.STATE_STORE.get(`used:${state}`);
    if (stateUsed) {
      return errorResponse('State already used', 400);
    }
    
    // Mark state as used
    await env.STATE_STORE.put(`used:${state}`, '1', { expirationTtl: 600 });
    
    // Proceed with validated inputs
    const isValidState = await validateState(state, env);
    if (!isValidState) {
      return errorResponse('State validation failed', 401);
    }
    
    const tokens = await exchangeCodeForTokens(code, env);
    return handleSuccessfulAuth(tokens, env);
    
  } catch (error) {
    console.error('Validation error:', error);
    return errorResponse('Request validation failed', 400);
  }
}
```

## Testing Requirements
- Test with various malformed inputs
- Verify length limits are enforced
- Test special character handling
- Validate error messages don't leak information
- Test with known injection patterns
- Verify state can't be reused

## Compliance
- **OWASP Top 10**: A03:2021 - Injection
- **CWE-20**: Improper Input Validation
- **CWE-89**: SQL Injection (if data reaches database)
- **CWE-79**: Cross-site Scripting

## Priority
**HIGH** - Must be fixed before production deployment

## References
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [RFC 6749 - OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)