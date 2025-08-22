# Manual End-to-End Testing Plan for OAuth Flow

## Overview

This document provides comprehensive instructions for manually testing the Google OAuth authentication flow in the local development environment. The application uses Google OAuth 2.0 with PKCE (Proof Key for Code Exchange) security and popup-based authentication.

## Test Environment Setup

### Prerequisites

1. **Node.js and npm**: Version 18+ required
2. **Browser Requirements**:
   - Chrome 90+ (primary test browser)
   - Firefox 88+ (secondary test browser)
   - Safari 14+ (if macOS available)
3. **Network Requirements**:
   - Internet connection for Google OAuth API
   - Access to `localhost` and `127.0.0.1`

### Environment Configuration

#### 1. Google OAuth Configuration

The application is pre-configured with a Google OAuth client:
- **Client ID**: `200871674285-39ni3ek941gka7tp7a4894eg7noe9ude.apps.googleusercontent.com`
- **Authorized Redirect URI**: `https://promptedblog.com/oauth-callback`
- **Scopes**: `openid`, `email`, `profile`

> **Note**: For local testing, you may need to modify the redirect URI configuration or use a local tunnel service.

#### 2. Development Server Setup

The project uses Cloudflare Wrangler for local development:

```bash
# Navigate to project root
cd /tmp/epic-oauth-flow-bug

# Install dependencies
npm install

# Build the project
npm run build

# Start development server
npm run dev
```

The development server will start on `http://localhost:8787` (Wrangler default) or the configured port.

#### 3. Local Environment Variables

For local development, create a `.dev.vars` file in the `workers` directory:

```bash
# workers/.dev.vars
GOOGLE_CLIENT_ID=200871674285-39ni3ek941gka7tp7a4894eg7noe9ude.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
OAUTH_SESSION_ENCRYPTION_KEY=<32-byte-base64-key>
```

#### 4. KV Storage Setup

The application uses Cloudflare KV for session storage:
- **Binding**: `OAUTH_SESSIONS`
- **Namespace ID**: `f1472e40eabb4718a0153daad5a458a7`

For local development, Wrangler will create a local KV instance.

## Test Scenarios

### Scenario 1: Successful Google OAuth Flow

#### Test Steps

1. **Initialize Application**
   - Open browser and navigate to `http://localhost:8787`
   - Verify the OAuth flow start component is displayed
   - Check for "Sign in with Google" button

2. **Start OAuth Flow**
   - Click "Sign in with Google" button
   - Verify popup window opens with Google OAuth consent screen
   - Confirm URL contains `accounts.google.com`

3. **Google Authorization**
   - Use a valid Google test account
   - Select account (if multiple accounts available)
   - Review and accept permissions:
     - View your email address
     - See your personal info (name, profile picture)
   - Click "Allow"

4. **OAuth Callback Processing**
   - Verify popup shows "Processing OAuth response..." spinner
   - Verify popup shows "Processing complete!" success message
   - Verify popup automatically closes after 1.5 seconds

5. **Post-Authentication State**
   - Verify main window redirects to dashboard or authenticated view
   - Check for user profile information display
   - Verify session is established (inspect cookies for session data)

#### Expected Results

- ✅ Popup opens without being blocked
- ✅ Google OAuth consent screen loads properly
- ✅ Authorization completes successfully
- ✅ Popup callback processing works correctly
- ✅ Session is established and user is authenticated
- ✅ User profile data is accessible
- ✅ No console errors in browser developer tools

### Scenario 2: Popup Blocked by Browser

#### Test Steps

1. **Block Popups**
   - Open browser settings and block popups for localhost
   - Or use browser with strict popup blocking

2. **Attempt OAuth Flow**
   - Navigate to application
   - Click "Sign in with Google"
   - Observe popup blocking behavior

#### Expected Results

- ✅ Application detects popup is blocked
- ✅ User-friendly error message displayed
- ✅ Instructions provided to enable popups
- ✅ No crashes or unhandled exceptions

### Scenario 3: User Cancels OAuth Flow

#### Test Steps

1. **Start OAuth Flow**
   - Click "Sign in with Google"
   - Verify popup opens

2. **Cancel Flow**
   - Close popup window before completing authorization
   - Or click "Cancel" on Google consent screen

#### Expected Results

- ✅ Application detects popup was closed
- ✅ Appropriate "Authentication cancelled" message shown
- ✅ User can retry authentication
- ✅ No session is created

### Scenario 4: Network Connectivity Issues

#### Test Steps

1. **Simulate Network Issues**
   - Disable network connection temporarily
   - Or use browser developer tools to simulate slow/failed network

2. **Attempt OAuth Flow**
   - Try to start OAuth flow
   - Observe timeout and error handling

#### Expected Results

- ✅ Network errors are caught and handled gracefully
- ✅ User-friendly error messages displayed
- ✅ Retry functionality works when network is restored
- ✅ No application crashes

### Scenario 5: Session Validation and Logout

#### Test Steps

1. **Establish Session**
   - Complete successful OAuth flow from Scenario 1

2. **Test Session Persistence**
   - Refresh the page
   - Verify user remains authenticated
   - Check session validity

3. **Test Logout**
   - Find and click logout button/link
   - Verify session is cleared
   - Verify redirect to home page
   - Verify re-authentication is required

#### Expected Results

- ✅ Session persists across page refreshes
- ✅ Logout clears session properly
- ✅ Post-logout state requires re-authentication
- ✅ Session cookies are cleared

### Scenario 6: Cross-Browser Compatibility

#### Test Steps

Repeat Scenario 1 (Successful OAuth Flow) in each supported browser:

1. **Chrome Testing**
   - Latest Chrome version
   - Test with and without extensions
   - Test in incognito mode

2. **Firefox Testing**
   - Latest Firefox version
   - Test with and without add-ons
   - Test in private browsing mode

3. **Safari Testing** (if available)
   - Latest Safari version
   - Test with default settings

#### Expected Results

- ✅ OAuth flow works consistently across all browsers
- ✅ Popup behavior is consistent
- ✅ No browser-specific JavaScript errors
- ✅ UI renders correctly in all browsers

## Testing Checklist

### Pre-Test Setup
- [ ] Development server starts successfully (`npm run dev`)
- [ ] Application loads at `http://localhost:8787`
- [ ] Browser developer tools show no critical errors
- [ ] Google OAuth client configuration is correct
- [ ] KV storage binding is properly configured

### Core OAuth Flow Tests
- [ ] **Successful Authentication**: Complete OAuth flow with valid Google account
- [ ] **Popup Functionality**: Popup opens, processes callback, and closes properly
- [ ] **Session Management**: Session is created and persists correctly
- [ ] **User Profile**: User information is retrieved and displayed
- [ ] **Security Validation**: CSRF protection (state parameter) works correctly

### Error Handling Tests
- [ ] **Popup Blocked**: Error handling when popup is blocked by browser
- [ ] **User Cancellation**: Proper handling when user closes popup or denies consent
- [ ] **Network Errors**: Graceful degradation during network issues
- [ ] **Invalid States**: Proper handling of malformed OAuth responses
- [ ] **Timeout Handling**: Request timeouts are handled appropriately

### Browser Compatibility Tests
- [ ] **Chrome**: Full OAuth flow works in latest Chrome
- [ ] **Firefox**: Full OAuth flow works in latest Firefox
- [ ] **Safari**: Full OAuth flow works in Safari (if available)
- [ ] **Incognito/Private Mode**: Works in private browsing modes

### Session Management Tests
- [ ] **Session Persistence**: Session survives page refresh
- [ ] **Session Validation**: Server properly validates session cookies
- [ ] **Logout Functionality**: Logout clears session and redirects properly
- [ ] **Re-authentication**: Post-logout requires new authentication

### Security and Performance Tests
- [ ] **PKCE Implementation**: Code challenge/verifier flow works correctly
- [ ] **CSRF Protection**: State parameter validation prevents CSRF attacks
- [ ] **Cookie Security**: HttpOnly cookies are used for session management
- [ ] **Performance**: OAuth flow completes within reasonable time (< 10 seconds)

## Configuration Requirements

### Google OAuth App Configuration

For production or thorough testing, ensure the Google OAuth app is configured with:

1. **Authorized JavaScript Origins**:
   - `http://localhost:8787` (for local development)
   - `https://promptedblog.com` (for production)

2. **Authorized Redirect URIs**:
   - `https://promptedblog.com/oauth-callback`
   - Additional local URIs if needed for testing

3. **Scopes**:
   - `openid` (required for OAuth 2.0)
   - `email` (user email address)
   - `profile` (user profile information)

### Environment Variables

Required environment variables for the Cloudflare Worker:

```bash
GOOGLE_CLIENT_ID=200871674285-39ni3ek941gka7tp7a4894eg7noe9ude.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
OAUTH_SESSION_ENCRYPTION_KEY=<32-byte-base64-encoded-key>
```

### Browser Configuration

For testing popup functionality:

1. **Allow Popups**: Ensure popups are allowed for localhost in browser settings
2. **JavaScript Enabled**: Ensure JavaScript is enabled
3. **Cookies Enabled**: Ensure cookies are enabled for session management
4. **Third-party Cookies**: May need to allow third-party cookies for Google OAuth

## Common Issues and Troubleshooting

### Issue 1: Popup Blocked
**Symptoms**: Click on "Sign in with Google" but no popup appears
**Solution**: 
- Check browser popup blocker settings
- Add localhost to popup exceptions
- Try in incognito/private mode

### Issue 2: Invalid Redirect URI
**Symptoms**: Google shows "redirect_uri_mismatch" error
**Solution**:
- Verify Google OAuth app configuration
- Ensure redirect URIs match exactly (including protocol and port)
- Check for typos in configuration

### Issue 3: Session Not Persisting
**Symptoms**: User gets logged out on page refresh
**Solution**:
- Check cookie settings in browser
- Verify HttpOnly cookies are being set by server
- Ensure KV storage is working correctly

### Issue 4: "invalid_grant" Error
**Symptoms**: Token exchange fails with "invalid_grant"
**Solution**:
- Verify PKCE implementation
- Check system clock synchronization
- Ensure authorization code is not expired (5-minute window)

### Issue 5: Network Timeout
**Symptoms**: OAuth flow hangs or times out
**Solution**:
- Check network connectivity
- Verify Google OAuth endpoints are accessible
- Increase timeout values if needed

## Test Data and Accounts

### Google Test Account
Use a dedicated Google test account for OAuth testing:
- Create a separate Google account for testing
- Do not use personal Google accounts
- Consider using Google's test environments if available

### Test Scenarios Data
- **Valid Email Format**: test@example.com
- **Long Username**: Create scenarios with long usernames to test UI
- **Special Characters**: Test usernames with allowed special characters

## Reporting Issues

When reporting issues found during testing, include:

1. **Environment Information**:
   - Browser and version
   - Operating system
   - Node.js version
   - Application build/commit hash

2. **Steps to Reproduce**:
   - Exact sequence of actions taken
   - Expected vs actual behavior
   - Screenshots or screen recordings if helpful

3. **Technical Details**:
   - Browser console errors
   - Network request failures (from dev tools)
   - Server logs if accessible

4. **Impact Assessment**:
   - Critical: Blocks core functionality
   - High: Affects user experience significantly
   - Medium: Minor usability issues
   - Low: Cosmetic or edge case issues

## Success Criteria

The OAuth implementation passes manual testing when:

- ✅ All core OAuth flow scenarios work across supported browsers
- ✅ Error handling provides clear, actionable feedback to users
- ✅ Security measures (PKCE, CSRF protection) are functioning correctly
- ✅ Session management works reliably
- ✅ Performance meets acceptable standards (< 10 second flow completion)
- ✅ No critical security vulnerabilities identified
- ✅ User experience is smooth and intuitive

## Next Steps

After completing manual testing:

1. **Document Results**: Record test results in a structured format
2. **Address Issues**: Fix any critical or high-priority issues found
3. **Automate Critical Paths**: Consider automating the most critical test scenarios
4. **Performance Optimization**: Address any performance issues identified
5. **Security Review**: Conduct additional security testing if needed

---

**Note**: This testing plan should be executed before deploying OAuth functionality to production. Update this document as the implementation evolves or new edge cases are discovered.