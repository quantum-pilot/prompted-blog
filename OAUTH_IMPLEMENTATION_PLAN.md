# OAuth User Onboarding & Admin Dashboard Implementation Plan

## Overview
Implementation plan for user authentication, subdomain registration, and admin dashboard with encrypted LLM API key management.

## User Flow
1. User clicks OAuth login (Google)
2. Account created/retrieved, JWT cookie set
3. User selects unique subdomain (username.promptedblog.com)
4. Redirected to subdomain.promptedblog.com/admin
5. Required to add LLM API keys before proceeding
6. Access to full admin dashboard features

## Technical Architecture
- **Frontend**: Web Components, TypeScript, CSS Modules
- **Backend**: Cloudflare Workers, KV Storage
- **Auth**: JWT in httpOnly cookies
- **Encryption**: Web Crypto API for API keys
- **Routing**: Client-side with subdomain detection

## Implementation Phases

### Phase 1: Enhanced OAuth Flow with User Creation

#### Step 1 - Backend OAuth Enhancement
- **Agent**: `cloudflare-backend`
- **Tasks**:
  ```yaml
  component: oauth-handler
  operation: modify
  description: Extend callback to create user accounts
  acceptance:
    - Create user profile in KV if new user
    - Generate JWT token with user claims
    - Set secure httpOnly cookie with JWT
    - Return user data to frontend
  ```

#### Step 2 - JWT Session Management
- **Agent**: `cloudflare-backend`
- **Tasks**:
  ```yaml
  component: jwt-handler
  operation: create
  description: JWT generation and validation module
  acceptance:
    - Generate signed JWTs with expiry
    - Validate JWT on protected routes
    - Implement refresh token mechanism
    - Middleware for route protection
  ```

### Phase 2: Subdomain Registration Flow

#### Step 3 - Subdomain Registration Component
- **Agent**: `components`
- **Tasks**:
  ```yaml
  component: subdomain-selector
  operation: create
  description: Component for subdomain name selection
  acceptance:
    - Input field with real-time validation
    - Check availability via API
    - Show error/success states
    - Submit handler for claiming subdomain
  ```

#### Step 4 - Subdomain Backend API
- **Agent**: `cloudflare-backend`
- **Tasks**:
  ```yaml
  component: subdomain-api
  operation: create
  description: API endpoints for subdomain management
  acceptance:
    - GET /api/subdomain/check endpoint
    - POST /api/subdomain/claim endpoint
    - Unique constraint validation
    - Store subdomain->userId mapping in KV
  ```

#### Step 5 - Subdomain Registration Styles
- **Agent**: `styles`
- **Tasks**:
  ```yaml
  component: subdomain-selector
  operation: create
  description: Styles for subdomain selection UI
  acceptance:
    - Input field styling with states
    - Availability indicator colors
    - Loading spinner animation
    - Responsive mobile layout
  ```

### Phase 3: Admin Dashboard & Routing

#### Step 6 - Router Foundation
- **Agent**: `foundation`
- **Tasks**:
  ```yaml
  component: router
  operation: create
  description: Client-side routing with auth guards
  acceptance:
    - Parse subdomain from window.location
    - Route definitions for /admin paths
    - Authentication check middleware
    - Redirect logic for unauthenticated users
  ```

#### Step 7 - Admin Dashboard Layout
- **Agent**: `components`
- **Tasks**:
  ```yaml
  component: admin-dashboard
  operation: create
  description: Main admin dashboard container
  acceptance:
    - Dashboard layout with sidebar/main content
    - User info display in header
    - Logout button functionality
    - API key status indicator
  ```

#### Step 8 - Dashboard Styles
- **Agent**: `styles`
- **Tasks**:
  ```yaml
  component: admin-dashboard
  operation: create
  description: Admin dashboard styling
  acceptance:
    - Two-column layout (sidebar + content)
    - Mobile responsive hamburger menu
    - Dark/light theme support
    - Smooth transitions
  ```

### Phase 4: LLM API Key Management

#### Step 9 - API Key Input Component
- **Agent**: `components`
- **Tasks**:
  ```yaml
  component: api-key-manager
  operation: create
  description: Component for managing LLM API keys
  acceptance:
    - Provider cards (Claude, OpenAI, Gemini)
    - Secure password input fields
    - Show/hide toggle for keys
    - Save/update handlers
  ```

#### Step 10 - Encrypted Storage Backend
- **Agent**: `cloudflare-backend`
- **Tasks**:
  ```yaml
  component: encryption-service
  operation: create
  description: Encrypt and store API keys
  acceptance:
    - AES-GCM encryption using Web Crypto
    - POST /api/keys/save endpoint
    - GET /api/keys/status endpoint
    - Secure key derivation from master key
  ```

#### Step 11 - API Key Manager Styles
- **Agent**: `styles`
- **Tasks**:
  ```yaml
  component: api-key-manager
  operation: create
  description: Styles for API key management UI
  acceptance:
    - Provider brand colors
    - Card-based layout
    - Success/error indicators
    - Responsive grid
  ```

### Phase 5: State Management & Guards

#### Step 12 - App State Foundation
- **Agent**: `foundation`
- **Tasks**:
  ```yaml
  component: app-state
  operation: create
  description: Global state management singleton
  acceptance:
    - Track auth status
    - Store user profile
    - Cache API key status
    - LocalStorage persistence
  ```

#### Step 13 - Route Guards Component
- **Agent**: `components`
- **Tasks**:
  ```yaml
  component: auth-guard
  operation: create
  description: Authentication guard wrapper
  acceptance:
    - Check JWT validity
    - Redirect to login if expired
    - Force API key setup if missing
    - Loading state during checks
  ```

### Phase 6: Security Review

#### Step 14 - Security Audit
- **Agent**: `security`
- **Tasks**:
  ```yaml
  review_type: story
  components_modified: all
  description: Full security review of OAuth and key management
  acceptance:
    - JWT implementation secure
    - API keys properly encrypted
    - XSS/CSRF protections in place
    - Input validation comprehensive
  ```

## Data Models

### KV Namespaces
```typescript
// USERS: userId -> UserProfile
interface UserProfile {
  id: string;
  email: string;
  googleId: string;
  subdomain?: string;
  createdAt: string;
  updatedAt: string;
}

// SUBDOMAINS: subdomain -> userId
interface SubdomainMapping {
  subdomain: string;
  userId: string;
  claimedAt: string;
}

// USER_KEYS: userId -> EncryptedKeys
interface EncryptedKeys {
  claude?: string;  // AES-GCM encrypted
  openai?: string;  // AES-GCM encrypted
  gemini?: string;  // AES-GCM encrypted
  iv: string;       // Initialization vector
  updatedAt: string;
}

// OAUTH_SESSIONS: sessionId -> SessionData (existing)
```

## API Endpoints

### Authentication
- `POST /oauth/callback` - OAuth callback handler (enhance existing)
- `GET /api/session/validate` - Validate current JWT
- `POST /api/session/refresh` - Refresh JWT token
- `POST /api/logout` - Clear session

### User Management
- `GET /api/user/profile` - Get current user profile
- `GET /api/subdomain/check?name={name}` - Check subdomain availability
- `POST /api/subdomain/claim` - Claim a subdomain

### API Key Management
- `GET /api/keys/status` - Check which keys are configured
- `POST /api/keys/save` - Save encrypted API keys
- `DELETE /api/keys/{provider}` - Remove a specific key

## Security Considerations

### JWT Security
- Use HS256 or RS256 signing
- Short expiry (1 hour) with refresh tokens
- httpOnly, secure, sameSite cookies
- CSRF token for state-changing operations

### API Key Encryption
- AES-256-GCM encryption
- Unique IV per encryption
- Master key in environment variable
- Never log or expose decrypted keys

### Input Validation
- Subdomain: alphanumeric + hyphen, 3-30 chars
- API keys: format validation before encryption
- Email: RFC 5322 compliant validation
- Rate limiting on all endpoints

### CORS & CSP
- Strict CORS with allowed origins
- Content Security Policy headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

## Testing Strategy

### Unit Tests
- JWT generation/validation
- Encryption/decryption functions
- Input validation functions
- Component isolation tests

### Integration Tests
- Full OAuth flow
- Subdomain registration flow
- API key save/retrieve cycle
- Session refresh mechanism

### E2E Tests
- Complete user onboarding flow
- Dashboard navigation
- API key management UI
- Logout and re-authentication

## Rollout Plan

1. **Week 1**: Phase 1 - OAuth enhancement & JWT
2. **Week 2**: Phase 2 - Subdomain registration
3. **Week 3**: Phase 3 - Admin dashboard
4. **Week 4**: Phase 4 - API key management
5. **Week 5**: Phase 5 - State management & guards
6. **Week 6**: Phase 6 - Security review & fixes

## Success Metrics

- User can complete full onboarding in < 2 minutes
- JWT refresh works seamlessly
- Zero plaintext API keys in logs/storage
- All E2E tests passing
- Security audit finds no critical issues

## Dependencies

### Required KV Namespaces
```bash
wrangler kv:namespace create USERS
wrangler kv:namespace create SUBDOMAINS  
wrangler kv:namespace create USER_KEYS
# OAUTH_SESSIONS already exists
```

### Environment Variables
```env
# Existing
GOOGLE_CLIENT_ID=xxx
REDIRECT_URI=xxx
FRONTEND_URL=xxx
SESSION_ENCRYPTION_KEY=xxx

# New Required
JWT_SECRET=xxx            # For JWT signing
API_KEY_MASTER_KEY=xxx    # For API key encryption
ALLOWED_SUBDOMAINS=xxx    # Reserved subdomains list
```

## Future Enhancements

- GitHub OAuth provider support
- Multiple accounts per user
- API key rotation reminders
- Usage analytics dashboard
- Team/organization accounts
- Custom domain support