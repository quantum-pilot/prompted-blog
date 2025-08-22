# Authentication Flow Integration

## Overview
The authentication system integrates three key components to provide a seamless user experience:
1. **OAuth Client** (`src/api/oauth-client.ts`) - Manages OAuth flow with server-driven PKCE
2. **Username Setup Handler** (`src/username-setup-handler.ts`) - Manages username setup after OAuth
3. **Auth Handler Component** (`src/components/auth-handler/`) - Routes users to admin panel

## OAuth Flow Architecture

The OAuth implementation uses a **server-driven PKCE flow** for enhanced security:

### Key Security Features
- **PKCE (Proof Key for Code Exchange)**: Prevents authorization code interception
- **Server-managed challenge storage**: PKCE challenges stored securely on server
- **CSRF protection**: State parameter validation
- **Popup-only mode**: No redirect-based flow for better security
- **Memory-only client storage**: No localStorage/sessionStorage usage
- **HttpOnly cookies**: Session tokens not accessible to client-side JavaScript

### 1. OAuth Flow Initiation
```
User clicks "Sign in with Google" → 
  1. Client generates PKCE verifier + challenge
  2. Client calls /oauth/authorize with challenge + state
  3. Server stores challenge in KV with 10-minute TTL
  4. Server returns provider authorization URL
  5. Client opens popup with authorization URL
```

### 2. OAuth Authorization & Callback
```
User authorizes in popup → 
  1. Provider redirects to callback with auth code
  2. Popup sends code + state to parent window
  3. Client calls /oauth/callback with code + verifier + state
  4. Server validates state and PKCE challenge
  5. Server exchanges code for tokens with provider
  6. Server creates session and sets HttpOnly cookie
  7. Client receives success response
```

### 3. Username Setup Check
After successful OAuth authentication:
```
checkAndShowUsernameSetup() called →
  If user has username → Dispatch "username-ready" event
  If no username → Show username-setup-modal
```

### 4. Username Setup (if needed)
```
Username modal shown → User enters username
Username validated → User submits
Modal dispatches "username-setup-complete" event
Handler removes modal and dispatches "username-ready" event
```

### 5. Admin Panel Routing
```
Auth Handler listens for "username-ready" event
Event received → Routes to admin panel:
  - Local: /admin
  - Production: https://{username}.promptedblog.com/admin/
```

## API Endpoints

### OAuth Endpoints
- **GET /oauth/authorize** - Initiate OAuth flow, store PKCE challenge
  - Query params: `code_challenge`, `state`, `provider`
  - Returns: `{ success: true, authorizationUrl: string }`
  - Rate limit: 20 requests/minute

- **POST /oauth/callback** - Complete OAuth flow, exchange code for session
  - Body: `{ code, state, code_verifier, provider }`
  - Returns: `{ success: true }` (sets HttpOnly cookie)
  - Rate limit: 10 requests/minute

- **GET /oauth/session** - Validate current session
  - Uses HttpOnly cookie for authentication
  - Returns: `{ valid: boolean, user?: UserInfo }`

- **POST /oauth/logout** - Clear session
  - Clears HttpOnly cookie
  - Returns: `{ success: true }`

### Flow Architecture Diagram

```
┌─────────────────┐    1. Generate PKCE    ┌──────────────────┐
│   Client App    │───────────────────────▶│ OAuth Client     │
│                 │                        │ (frontend)       │
└─────────────────┘                        └──────────────────┘
                                                     │
                                          2. Call /oauth/authorize
                                            (code_challenge, state)
                                                     ▼
┌─────────────────┐                        ┌──────────────────┐
│  OAuth Popup    │                        │ Cloudflare       │
│                 │◀─── 3. Authorization ──│ Worker           │
│                 │     URL returned       │                  │
└─────────────────┘                        └──────────────────┘
         │                                           │
         │ 4. User authorizes                        │ Store PKCE challenge
         ▼                                           ▼
┌─────────────────┐                        ┌──────────────────┐
│ Google OAuth    │                        │ Cloudflare KV    │
│                 │                        │ (OAUTH_SESSIONS) │
│                 │                        └──────────────────┘
└─────────────────┘                                 
         │                                          
         │ 5. Redirect with auth code               
         ▼                                          
┌─────────────────┐    6. POST /oauth/callback     ┌──────────────────┐
│   Client App    │───────────────────────────────▶│ Cloudflare       │
│                 │   (code, state, verifier)      │ Worker           │
│                 │◀─── 7. Session cookie ────────│                  │
└─────────────────┘                                └──────────────────┘
                                                             │
                                                   8. Verify PKCE &
                                                    Exchange tokens
                                                             ▼
                                                   ┌──────────────────┐
                                                   │ Google Token     │
                                                   │ Endpoint         │
                                                   └──────────────────┘
```

## Key Components

### OAuth Client (`src/api/oauth-client.ts`)
- **Server-driven PKCE flow**: Calls `/oauth/authorize` to get authorization URL
- **Enhanced error handling**: Comprehensive error types and user-friendly messages
- **Retry logic**: Automatic retry for network failures
- **Popup management**: Secure popup-based authentication
- **Session validation**: Works with HttpOnly cookies
- **Memory-only storage**: No persistent client-side token storage

### Username Setup Handler (`src/username-setup-handler.ts`)
- Checks if user has username via ProfileClient
- Shows username setup modal if needed
- Dispatches `username-ready` event when username exists or is set
- Handles errors gracefully

### Auth Handler Component (`src/components/auth-handler/`)
- Web Component that listens for `username-ready` events
- Routes authenticated users with usernames to admin panel
- Checks authentication status on initialization
- Handles both local and production routing

## Event Flow

### Success Path Events
1. `oauth-start` - User initiates OAuth flow
2. `oauth-success` - OAuth authentication successful
3. `username-ready` - User has or has set username
4. Navigation to admin panel

### Error Path Events
1. `oauth-error` - OAuth flow failed
2. `username-setup-error` - Username setup failed

## Integration Points

### Main Entry (`src/main.ts`)
```javascript
// Register all components
registerComponents();

// Setup event handlers
setupEventHandlers();

// Setup OAuth handler
setupOAuthHandler();

// Add auth-handler component
const authHandler = document.createElement("auth-handler");
document.body.appendChild(authHandler);
```

### Session Management
- Sessions stored in cookies via `oauth-session.ts`
- Session validation through OAuthClient
- Automatic session restoration on page load

## Testing

### Unit Tests
- `src/api/__tests__/oauth-client.test.ts` - OAuth client logic and error handling
- `src/__tests__/username-setup-handler.test.ts` - Username setup logic
- `src/components/auth-handler/__tests__/auth-handler.test.ts` - Auth handler component
- `workers/src/oauth-client/__tests__/` - Server-side OAuth handler tests
- `workers/src/__tests__/hono-integration.test.ts` - API integration tests

### Security Tests
- `workers/src/oauth-client/__tests__/pkce-security.test.ts` - PKCE implementation security
- `workers/src/oauth-client/__tests__/csrf-protection.test.ts` - CSRF attack prevention
- `workers/src/oauth-client/__tests__/xss-security.test.ts` - XSS prevention

### Integration Tests
- `src/__tests__/auth-integration.test.ts` - Full flow integration tests
- `workers/__tests__/oauth.route.test.ts` - OAuth endpoint testing

### E2E Tests
- `e2e/auth-flow.spec.ts` - Browser-based authentication flow tests

### Testing the OAuth Flow

#### Manual Testing
1. **Start Development Server**: `npm run dev`
2. **Open Browser**: Navigate to `http://localhost:3000`
3. **Trigger OAuth**: Click "Sign in with Google"
4. **Verify Popup**: Should open Google OAuth consent screen
5. **Complete Flow**: Authorize and verify redirect to admin panel
6. **Test Error Cases**: Block popup, deny access, network failures

#### Environment Setup
```bash
# Required environment variables
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback

# For production
OAUTH_SESSION_SECRET=your_secret_key
CLOUDFLARE_KV_NAMESPACE_ID=your_namespace
```

#### Expected Behavior
- **Success**: User redirected to admin panel with session cookie set
- **Error**: Clear error message displayed, no sensitive data exposed
- **Security**: All PKCE parameters cleared from client memory
- **Logging**: Server-side audit trail of all OAuth events

## Security Considerations

### PKCE Implementation
- **Client-generated verifier**: Cryptographically secure random string (256-bit entropy)
- **SHA256 challenge**: Code challenge calculated from verifier using SHA-256
- **Server storage**: Challenge stored in Cloudflare KV with automatic expiration
- **Verification**: Server validates verifier matches stored challenge during token exchange

### Additional Security Measures
1. **HTTPS Enforcement** - Redirects to HTTPS in production
2. **Session Validation** - Sessions validated with backend using HttpOnly cookies
3. **CSRF Protection** - OAuth state parameter validation with secure random generation
4. **Secure Cookies** - Session tokens stored in httpOnly, secure, sameSite cookies
5. **Rate Limiting** - OAuth endpoints protected against abuse
6. **XSS Prevention** - No client-side token storage, server-side input sanitization
7. **Popup Security** - Origin validation and secure message passing

## Error Handling

The OAuth client provides comprehensive error handling with user-friendly messages:

### OAuth-Specific Errors
1. **Authorization Failed** - User denied access or provider error
2. **Token Exchange Failed** - Server couldn't exchange code for tokens
3. **CSRF Attack Detected** - State parameter mismatch
4. **Popup Blocked** - Browser blocked authentication popup
5. **Timeout** - Request took too long (30-second limit)

### Common Error Scenarios
1. **Network Errors** - Automatic retry with exponential backoff
2. **Server Errors** - Clear technical/user message separation
3. **PKCE Verification Failure** - Returns `invalid_grant` error
4. **Session Expiry** - Graceful logout and redirect to login

### Troubleshooting

#### `invalid_grant` Error
This error occurs when PKCE verification fails during token exchange:

**Possible Causes:**
- PKCE challenge expired (10-minute TTL)
- State parameter mismatch (CSRF attack or session issue)
- Authorization code already used or invalid
- Server-side PKCE storage issue

**Resolution:**
1. User should retry the OAuth flow (generates new PKCE parameters)
2. Check server logs for specific failure reason
3. Verify Cloudflare KV is accessible and not hitting limits
4. Ensure system clocks are synchronized (for TTL validation)

**For Developers:**
- PKCE challenges are stored as `pkce:{state}` in `OAUTH_SESSIONS` KV
- Check audit logs for `PKCE_VERIFICATION_FAILURE` events
- Verify OAuth provider configuration (client ID, secret)
- Test with shorter flows to isolate timing issues

## Future Enhancements

1. Add support for additional OAuth providers (GitHub, etc.)
2. Implement session refresh mechanism
3. Add remember me functionality
4. Enhance error recovery flows