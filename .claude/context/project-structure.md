---
created: 2025-08-21T17:53:12Z
last_updated: 2025-08-21T17:53:12Z
version: 1.0
author: Claude Code PM System
---

# Project Structure

## Root Directory Organization
```
/workspace/
├── .claude/           # Claude AI configuration and agents
│   ├── agents/        # Specialized agent definitions
│   ├── commands/      # Custom command definitions
│   ├── context/       # Project context documentation
│   ├── epics/         # Epic tracking
│   ├── prds/          # Product requirement documents
│   ├── rules/         # Development rules and patterns
│   └── scripts/       # Automation scripts
├── .devcontainer/     # VS Code dev container config
├── .github/           # GitHub Actions workflows
├── .vscode/           # VS Code workspace settings
├── _OLD/              # Archived/deprecated code
├── dist/              # Built frontend assets
├── docs/              # Project documentation
├── e2e/               # End-to-end Playwright tests
├── node_modules/      # NPM dependencies
├── scripts/           # Build and utility scripts
├── shared/            # Shared code between frontend/backend
├── src/               # Frontend source code
├── test-results/      # Test execution results
└── workers/           # Cloudflare Workers backend

## Key Directories

### Frontend (`/src`)
```
src/
├── api/               # API client modules
│   ├── api-client.ts
│   ├── auth-client.ts
│   └── profile-client.ts
├── components/        # Web Components
│   ├── admin/         # Admin panel components
│   ├── auth/          # Authentication components
│   └── oauth/         # OAuth flow components
├── services/          # Frontend services
│   └── errorHandler.ts
├── styles/            # CSS modules
│   └── (component-specific styles)
├── utils/             # Utility modules
│   ├── base-component.ts
│   ├── dom-helpers.ts
│   ├── event-manager.ts
│   └── router.ts
└── main.ts            # Application entry point
```

### Backend (`/workers`)
```
workers/
├── src/
│   ├── middleware/    # Request middleware
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   ├── rateLimit.ts
│   │   └── security.ts
│   ├── oauth-client/  # OAuth implementation
│   │   └── google.ts
│   ├── routes/        # API routes
│   │   ├── health.ts
│   │   ├── oauth.ts
│   │   ├── profile.ts
│   │   └── session.ts
│   ├── utils/         # Backend utilities
│   │   ├── audit.ts
│   │   ├── errors.ts
│   │   ├── kvstore.ts
│   │   └── request-context.ts
│   └── index.ts       # Worker entry point
├── dist/              # Compiled worker
├── test/              # Worker tests
└── wrangler.toml      # Cloudflare config
```

### Shared Code (`/shared`)
```
shared/
├── api/               # API type definitions
│   ├── http.ts
│   └── oauth.ts
├── contracts/         # Zod validation schemas
│   ├── auth.contract.ts
│   └── profile.contract.ts
└── types/             # Shared TypeScript types
```

### Testing (`/e2e`)
```
e2e/
├── auth/              # Authentication tests
├── oauth/             # OAuth flow tests
├── profile/           # Profile tests
├── admin/             # Admin panel tests
└── fixtures/          # Test fixtures and helpers
```

## File Naming Conventions
- **Components:** `component-name.ts` (kebab-case)
- **Styles:** `component-name.module.css` (CSS modules)
- **Tests:** `*.test.ts` or `*.spec.ts`
- **Contracts:** `*.contract.ts` (Zod schemas)
- **Routes:** Feature-based naming (e.g., `oauth.ts`)
- **Middleware:** Function-based naming (e.g., `auth.ts`)

## Module Organization Patterns
- **Barrel exports:** Index files for clean imports
- **Co-location:** Styles next to components
- **Separation:** Frontend/backend/shared boundaries
- **Type safety:** Contracts define API boundaries
- **Test proximity:** Tests near implementation

## Build Output Structure
```
dist/
├── index.html         # Main application entry
├── admin.html         # Admin panel entry
├── main.js            # Bundled frontend code
├── styles/            # Compiled CSS
└── assets/            # Static assets
```

## Configuration Files
- `package.json` - NPM dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vitest.config.ts` - Test runner configuration
- `playwright.config.ts` - E2E test configuration
- `wrangler.toml` - Cloudflare Workers config
- `.mcp.json` - MCP tool configuration
- `CLAUDE.md` - AI assistant instructions

## Static Files
- `index.html` - Main application shell
- `admin.html` - Admin panel interface
- HTML files served via Cloudflare Workers

## Script Organization
- `scripts/build.mjs` - Frontend build script
- `scripts/bundle-css.mjs` - CSS bundling
- `scripts/validate-structure.mjs` - Structure validation
- `.claude/scripts/pm/` - Project management scripts
- `.claude/scripts/test-and-log.sh` - Test execution