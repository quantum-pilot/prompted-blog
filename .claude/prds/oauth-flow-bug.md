---
name: oauth-flow-bug
description: Fix OAuth flow to properly route through server for PKCE challenge storage
status: backlog
created: 2025-08-22T05:47:20Z
---

# PRD: oauth-flow-bug

## Executive Summary

The current OAuth implementation has a critical bug where the client-side code bypasses the server's PKCE challenge storage mechanism by directly constructing Google OAuth URLs. This causes authentication failures with "invalid_grant" errors because the server cannot verify PKCE challenges it never stored. This PRD outlines the fix to ensure all OAuth flows properly route through the server's `/oauth/authorize` endpoint.

## Problem Statement

### What problem are we solving?
The OAuth authentication flow is broken due to improper PKCE (Proof Key for Code Exchange) handling. The client generates PKCE parameters locally and redirects directly to Google, bypassing the server's `/oauth/authorize` endpoint. When Google redirects back with the authorization code, the server cannot verify the PKCE challenge because it was never stored in KV storage, resulting in a 400 "invalid_grant" error.

### Why is this important now?
- **Blocks all user authentication**: No users can sign in via Google OAuth
- **Development blocker**: Cannot test any authenticated features locally
- **Pre-launch critical**: Must be fixed before any deployment or user testing
- **Security best practice**: Proper PKCE implementation is essential for OAuth security

## User Stories

### Primary User Persona
**Developer/Admin** trying to authenticate locally to test the application

### User Journey
1. User clicks "Sign in with Google" button
2. User is redirected to Google consent screen
3. User approves permissions
4. User is redirected back to application
5. **Expected**: User is successfully authenticated and redirected to dashboard
6. **Actual**: User receives 400 error and authentication fails

### Pain Points Being Addressed
- Complete inability to authenticate via OAuth
- Confusion from misleading error messages
- Broken development workflow

## Requirements

### Functional Requirements

#### Core Fix
1. **Update client OAuth flow** (`src/api/oauth-client.ts`):
   - Remove local PKCE generation logic
   - Call server's `/oauth/authorize` endpoint instead of building Google URL
   - Handle the authorization URL response from server
   - Maintain proper error handling

2. **Preserve server implementation** (already correct):
   - Server's `/oauth/authorize` endpoint correctly generates and stores PKCE
   - Server's `/oauth/callback` endpoint correctly verifies PKCE
   - No changes needed to server code

3. **Client-server flow**:
   - Client initiates OAuth by calling `GET /oauth/authorize`
   - Server generates PKCE, stores in KV, returns Google OAuth URL
   - Client redirects to returned URL
   - Google redirects to callback page
   - Callback page POSTs to server with auth code
   - Server verifies PKCE and completes authentication

### Non-Functional Requirements

#### Performance
- OAuth initiation should complete within 500ms
- No additional round trips beyond the necessary OAuth flow

#### Security
- PKCE challenges must be cryptographically secure
- PKCE storage must use proper TTL (already implemented)
- No client-side storage of PKCE verifier

#### Code Quality
- Follow existing codebase patterns
- Maintain test coverage with TDD approach
- Use existing error handling patterns

## Success Criteria

### Measurable Outcomes
1. **Primary**: OAuth flow completes successfully without "invalid_grant" errors
2. **Authentication rate**: 100% success rate for valid Google accounts
3. **Error handling**: Clear error messages for actual failures (network, invalid account)

### Verification Steps
1. Click "Sign in with Google"
2. Complete Google consent
3. Successfully redirected to authenticated dashboard
4. User session properly established
5. Audit logs show successful authentication flow

## Constraints & Assumptions

### Constraints
- Must maintain compatibility with existing Google OAuth app configuration
- Cannot modify server-side OAuth implementation (working correctly)
- Must use existing KV storage for PKCE challenges

### Assumptions
- Google OAuth app is properly configured
- KV storage is available and functional
- Existing server endpoints are correct and tested
- Only Google OAuth provider needs support currently

## Out of Scope

- Adding additional OAuth providers (GitHub, etc.)
- Implementing refresh token handling
- Adding OAuth scope management
- Creating user registration flow
- Implementing MFA/2FA
- Adding session management improvements
- OAuth provider switching
- Social account linking

## Dependencies

### External Dependencies
- Google OAuth 2.0 service availability
- Google Cloud Console OAuth app configuration

### Internal Dependencies
- KV storage service (for PKCE storage)
- Existing `/oauth/authorize` endpoint
- Existing `/oauth/callback` endpoint
- Audit logging service

### No Dependencies On
- Database (session storage is separate)
- Other authentication methods
- User management services

## Testing Requirements

### Unit Tests
- Test client OAuth initiation flow
- Test error handling for network failures
- Test parameter validation

### Integration Tests
- Full OAuth flow with mock Google responses
- PKCE verification flow
- Error scenarios (expired PKCE, invalid grant)

### Manual Testing
- Local development environment OAuth flow
- Different browsers (Chrome, Firefox, Safari)
- Error recovery scenarios

## Implementation Notes

### Key Files to Modify
- `src/api/oauth-client.ts` - Remove local PKCE generation, call server endpoint

### Files That Should NOT Change
- `workers/src/routes/oauth.route.ts` - Server implementation is correct
- `workers/src/services/oauth.service.ts` - Service layer is correct
- OAuth callback HTML pages - These are working correctly

### Migration Steps
1. Update client OAuth initialization
2. Test locally with Google OAuth
3. Verify audit logs show correct flow
4. Ensure no regression in error handling