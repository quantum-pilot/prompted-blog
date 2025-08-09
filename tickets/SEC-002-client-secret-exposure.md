# SEC-002: High - Client Secret Exposure Risk

## Severity: HIGH

## Affected File
`/workspace/workers/src/oauth-google/token-exchange.ts`

## Description
The OAuth client secret is being used directly in a Cloudflare Worker (edge function), which poses a security risk. While environment variables in Workers are protected, using client secrets in edge workers goes against OAuth security best practices and increases the attack surface.

## Current Implementation
```typescript
// In token-exchange.ts line 13
const params = new URLSearchParams({
  code,
  client_id: env.CLIENT_ID,
  client_secret: env.CLIENT_SECRET,  // HIGH: Secret in edge worker
  redirect_uri: env.REDIRECT_URI,
  grant_type: 'authorization_code',
});
```

## Impact
- **Secret Compromise**: If the worker environment is compromised, the client secret could be exposed
- **Impersonation**: Attackers with the client secret could impersonate the application
- **Token Theft**: Malicious actors could exchange stolen authorization codes for tokens
- **Unauthorized Access**: Compromised secrets enable unauthorized access to user data

## Why This Is a Risk
- Edge workers run in multiple locations globally, increasing attack surface
- Client secrets should ideally be kept in secure backend services
- OAuth 2.0 best practices recommend using PKCE for public clients
- Violation of principle of least privilege

## Remediation Options

### Option 1: Use PKCE Flow (Recommended for Public Clients)
Implement Proof Key for Code Exchange (PKCE) which doesn't require a client secret:

```typescript
// During authorization
const codeVerifier = generateRandomString(128);
const codeChallenge = await sha256(codeVerifier);

// Store codeVerifier securely
await env.STATE_STORE.put(`verifier:${state}`, codeVerifier);

// Add to authorization URL
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

// During token exchange (no client_secret needed)
const params = new URLSearchParams({
  code,
  client_id: env.CLIENT_ID,
  redirect_uri: env.REDIRECT_URI,
  grant_type: 'authorization_code',
  code_verifier: codeVerifier, // Instead of client_secret
});
```

### Option 2: Move to Secure Backend Service
Create a separate backend service for token exchange:

```typescript
// Worker forwards to backend
export async function exchangeCodeForTokens(code: string, env: Env): Promise<TokenResponse> {
  const backendUrl = env.SECURE_BACKEND_URL;
  
  const response = await fetch(`${backendUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.BACKEND_API_KEY, // Internal auth
    },
    body: JSON.stringify({ code, redirect_uri: env.REDIRECT_URI }),
  });
  
  return response.json();
}
```

### Option 3: Use Cloudflare Secrets (Least Preferred)
If must keep in Worker, use Cloudflare's encrypted secrets:
```bash
wrangler secret put CLIENT_SECRET
```

## Testing Requirements
- Verify PKCE flow works correctly if implemented
- Test that client secret is never exposed in logs or responses
- Ensure token exchange works securely
- Validate error handling doesn't leak secret information

## Compliance
- **OAuth 2.0 Security BCP**: RFC 8252 Section 8.5
- **OWASP Top 10**: A02:2021 - Cryptographic Failures
- **CWE-798**: Use of Hard-coded Credentials

## Priority
**HIGH** - Must be fixed before production deployment

## References
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)