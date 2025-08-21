---
created: 2025-08-21T17:53:12Z
last_updated: 2025-08-21T17:53:12Z
version: 1.0
author: Claude Code PM System
---

# Technology Context

## Core Technologies

### Frontend Stack
- **Language:** TypeScript 5.3.0
- **Architecture:** Web Components (native)
- **Module System:** ES Modules
- **CSS:** CSS Modules with component scoping
- **Build Tool:** ESBuild 0.25.9
- **Dev Server:** http-server for local development

### Backend Stack
- **Runtime:** Cloudflare Workers (Edge Computing)
- **Framework:** Hono 4.9.2 (lightweight edge framework)
- **Language:** TypeScript 5.3.0
- **Deployment:** Wrangler 4.28.0

### Storage & Data
- **Session Storage:** Cloudflare KV (Key-Value store)
- **Database:** Planned for Cloudflare D1 (SQLite at edge)
- **Cache:** Cloudflare edge caching
- **Static Assets:** Served via Workers

## Dependencies

### Production Dependencies
```json
{
  "hono": "^4.9.2",           // Web framework for edge
  "oauth4webapi": "^3.7.0",   // OAuth 2.0 implementation
  "zod": "^4.0.17"            // Schema validation
}
```

### Development Dependencies
```json
{
  "@cloudflare/vitest-pool-workers": "^0.8.60",  // Worker testing
  "@cloudflare/workers-types": "^4.20250805.0",  // TypeScript types
  "@playwright/test": "^1.54.2",                 // E2E testing
  "@types/node": "^20.0.0",                      // Node types
  "@vitest/ui": "^3.2.4",                        // Test UI
  "esbuild": "^0.25.9",                          // Build tool
  "glob": "^11.0.3",                             // File matching
  "happy-dom": "^18.0.1",                        // DOM testing
  "playwright": "^1.54.2",                       // Browser automation
  "typescript": "^5.3.0",                        // TypeScript compiler
  "vitest": "^3.2.4",                            // Test runner
  "wrangler": "^4.28.0"                          // CF deployment
}
```

## Development Tools

### Build Pipeline
- **Frontend Build:** ESBuild for TypeScript compilation and bundling
- **CSS Processing:** Custom CSS module bundler script
- **Asset Optimization:** Minification and tree-shaking via ESBuild
- **Worker Build:** Wrangler build for Cloudflare Workers

### Testing Framework
- **Unit Tests:** Vitest with Happy DOM
- **Integration Tests:** Vitest with Cloudflare Workers pool
- **E2E Tests:** Playwright for cross-browser testing
- **Test Coverage:** Built-in Vitest coverage reporting

### Development Environment
- **Local Dev:** Wrangler dev server with hot reload
- **Container:** VS Code Dev Container support
- **Version Control:** Git with GitHub
- **CI/CD:** GitHub Actions (planned)

## API & Integration

### OAuth Providers
- **Google OAuth 2.0:** Primary authentication provider
- **PKCE Flow:** Proof Key for Code Exchange for security
- **Session Management:** Cookie-based with HttpOnly flags

### External Services
- **Cloudflare Services:**
  - Workers (compute)
  - KV (session storage)
  - D1 (database - planned)
  - R2 (object storage - planned)

### API Design
- **Framework:** Hono for routing and middleware
- **Validation:** Zod schemas for request/response
- **Serialization:** JSON with TypeScript types
- **Authentication:** Bearer tokens and cookies

## Security Stack

### Frontend Security
- **CSP:** Content Security Policy headers
- **XSS Protection:** Input sanitization
- **HTTPS:** Enforced in production

### Backend Security
- **Rate Limiting:** Per-endpoint limits
- **CORS:** Configurable origin restrictions
- **Headers:** Security headers middleware
- **Session Security:** Encrypted cookies

## Development Scripts

### NPM Scripts
```bash
npm run build      # Build frontend assets
npm run dev        # Start development server
npm run serve      # Serve built assets locally
npm run test       # Run all tests
npm run test:frontend  # Frontend unit tests
npm run test:workers   # Worker integration tests
npm run test:e2e   # End-to-end tests
npm run validate   # Validate project structure
```

## Environment Configuration

### Cloudflare Configuration
- **wrangler.toml:** Worker configuration
- **KV Namespaces:** OAUTH_SESSIONS for session data
- **Environment Variables:** Via wrangler secrets

### TypeScript Configuration
- **Target:** ES2022
- **Module:** ESNext
- **Strict Mode:** Enabled
- **Path Aliases:** Configured for clean imports

## Browser Support
- **Modern Browsers:** Chrome, Firefox, Safari, Edge (latest)
- **Web Components:** Native support required
- **ES Modules:** Native module support required

## Performance Optimization
- **Edge Computing:** Low latency via Cloudflare network
- **Code Splitting:** Component-based loading
- **Caching Strategy:** Edge caching for static assets
- **Bundle Size:** Optimized via ESBuild tree-shaking