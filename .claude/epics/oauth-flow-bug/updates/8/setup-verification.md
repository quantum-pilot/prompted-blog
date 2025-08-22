# OAuth Flow Setup Verification

## Quick Setup Check

Before starting manual testing, run these commands to verify the environment:

### 1. Build and Dependencies Check

```bash
cd /tmp/epic-oauth-flow-bug

# Install dependencies
npm install

# Verify build process
npm run build
```

**Expected Output**: 
- ✅ No build errors
- ✅ Files copied to `dist/` directory
- ✅ CSS bundled successfully

### 2. Development Server Test

```bash
# Start development server (will run until stopped)
npm run dev
```

**Expected Output**:
- ✅ Wrangler starts successfully
- ✅ Server listening on `http://localhost:8787` (or configured port)
- ✅ Assets served from `dist/` directory
- ✅ KV namespace bindings loaded

### 3. Application Accessibility Test

Open browser and navigate to: `http://localhost:8787`

**Expected Results**:
- ✅ Page loads without errors
- ✅ "Sign in with Google" button is visible
- ✅ No JavaScript errors in browser console
- ✅ Network tab shows static assets loading successfully

### 4. OAuth Configuration Verification

Check the OAuth configuration in the browser console:

```javascript
// Open browser developer console and run:
console.log('OAuth Config:', {
  clientId: '200871674285-39ni3ek941gka7tp7a4894eg7noe9ude.apps.googleusercontent.com',
  redirectUri: 'https://promptedblog.com/oauth-callback',
  provider: 'google'
});
```

### 5. Environment Variables (Optional)

For enhanced testing, create `workers/.dev.vars`:

```bash
cd workers
touch .dev.vars
```

Add the following content:
```
GOOGLE_CLIENT_ID=200871674285-39ni3ek941gka7tp7a4894eg7noe9ude.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-secret-here>
OAUTH_SESSION_ENCRYPTION_KEY=<32-byte-base64-key>
```

## Common Setup Issues

### Issue: Port Already in Use
```bash
# Find process using port 8787
lsof -i :8787
# Kill the process if needed
kill -9 <PID>
```

### Issue: Build Failures
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Wrangler Login
```bash
# Login to Cloudflare (if needed)
npx wrangler auth login
```

## Testing Environment Ready

Once all verification steps pass, you're ready to begin manual testing following the main E2E test plan.

**Next Step**: Start with "Scenario 1: Successful Google OAuth Flow" in the main test plan document.