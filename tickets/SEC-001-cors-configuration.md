# SEC-001: Critical - Overly Permissive CORS Configuration

## Severity: CRITICAL

## Affected File
`/workspace/workers/src/oauth-google/cors.ts`

## Description
The CORS configuration in the oauth-google worker allows all origins (`*`), which means any website can initiate OAuth flows through this worker. This creates a critical security vulnerability that could lead to CSRF attacks, token hijacking, and unauthorized access to user data.

## Current Implementation
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // CRITICAL: Allows any origin
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

## Impact
- **CSRF Attacks**: Malicious websites can initiate OAuth flows on behalf of users
- **Token Hijacking**: Attackers could potentially intercept or steal authentication tokens
- **Unauthorized Access**: Any domain can interact with the OAuth endpoints
- **Data Exposure**: User authentication data could be exposed to unauthorized origins

## Remediation Required
Implement a whitelist of allowed origins instead of allowing all origins:

```typescript
const ALLOWED_ORIGINS = [
  'https://promptedblog.com',
  'http://localhost:8000' // Only in development
];

export function getCorsHeaders(origin: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  return headers;
}
```

## Testing Requirements
- Verify that only whitelisted origins can make requests
- Test that non-whitelisted origins are properly rejected
- Ensure preflight OPTIONS requests work correctly
- Validate credentials are only sent to allowed origins

## Compliance
- **OWASP Top 10**: A07:2021 - Identification and Authentication Failures
- **CWE-942**: Permissive Cross-domain Policy with Untrusted Domains

## Priority
**IMMEDIATE** - This must be fixed before deployment to production

## References
- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP CORS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html)