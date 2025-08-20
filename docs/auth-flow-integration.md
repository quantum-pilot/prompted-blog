# Authentication Flow Integration

## Overview
The authentication system integrates three key components to provide a seamless user experience:
1. **OAuth Handler** (`src/oauth-handler.ts`) - Manages OAuth flow and callbacks
2. **Username Setup Handler** (`src/username-setup-handler.ts`) - Manages username setup after OAuth
3. **Auth Handler Component** (`src/components/auth-handler/`) - Routes users to admin panel

## Authentication Flow

### 1. Initial Authentication
```
User lands on site → OAuth Flow Start component shown
User clicks "Sign in with Google" → OAuth flow initiated
OAuth callback received → Session validated
```

### 2. Username Setup Check
After successful OAuth authentication:
```
checkAndShowUsernameSetup() called →
  If user has username → Dispatch "username-ready" event
  If no username → Show username-setup-modal
```

### 3. Username Setup (if needed)
```
Username modal shown → User enters username
Username validated → User submits
Modal dispatches "username-setup-complete" event
Handler removes modal and dispatches "username-ready" event
```

### 4. Admin Panel Routing
```
Auth Handler listens for "username-ready" event
Event received → Routes to admin panel:
  - Local: /admin
  - Production: https://{username}.promptedblog.com/admin/
```

## Key Components

### OAuth Handler (`src/oauth-handler.ts`)
- Manages OAuth flow initiation
- Handles OAuth callbacks
- Validates sessions
- Triggers username setup check after successful auth

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
- `src/__tests__/oauth-handler.test.ts` - OAuth handler logic
- `src/__tests__/username-setup-handler.test.ts` - Username setup logic
- `src/components/auth-handler/__tests__/auth-handler.test.ts` - Auth handler component

### Integration Tests
- `src/__tests__/auth-integration.test.ts` - Full flow integration tests

### E2E Tests
- `e2e/auth-flow.spec.ts` - Browser-based authentication flow tests

## Security Considerations

1. **HTTPS Enforcement** - Redirects to HTTPS in production
2. **Session Validation** - Sessions validated with backend
3. **CSRF Protection** - OAuth state parameter validation
4. **Secure Cookies** - Session stored in httpOnly, secure cookies

## Error Handling

1. **Unauthorized Access** - Silent failure, no modal shown
2. **Network Errors** - Error events dispatched for app handling
3. **OAuth Failures** - Clear session and redirect to home
4. **Username Setup Errors** - Error event dispatched for user feedback

## Future Enhancements

1. Add support for additional OAuth providers (GitHub, etc.)
2. Implement session refresh mechanism
3. Add remember me functionality
4. Enhance error recovery flows