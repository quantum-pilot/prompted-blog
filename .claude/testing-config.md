---
framework: vitest
test_command: npm test
created: 2025-08-22T05:58:53Z
---

# Testing Configuration

## Frameworks Detected

1. **Vitest** (v3.2.4) - Unit and integration tests

   - Frontend tests: `vitest --config vitest.config.ts`
   - Worker tests: `cd workers && vitest`
   - Config Files: `vitest.config.ts`, `workers/vitest.config.ts`

2. **Playwright** (v1.54.2) - E2E tests
   - Command: `playwright test`
   - Config File: `playwright.config.ts`

## Test Structure

- Test Files: 95+ test files found (79 unit tests + 16+ e2e tests)
- Test Directories:
  - `./src/__tests__/` - Frontend unit tests
  - `./src/utils/__tests__/` - Utility function tests
  - `./src/api/__tests__/` - API client tests
  - `./src/components/*/tests__/` - Component tests
  - `./workers/__tests__/` - Worker unit tests
  - `./workers/src/__tests__/` - Worker source tests
  - `./workers/src/middleware/__tests__/` - Middleware tests
  - `./workers/src/utils/__tests__/` - Worker utility tests
  - `./workers/src/oauth-client/__tests__/` - OAuth client tests
  - `./shared/contracts/__tests__/` - Contract tests
  - `./e2e/` - E2E tests with Playwright
- Naming Patterns:
  - Unit tests: `*.test.ts`
  - E2E tests: `*.spec.ts`

## Commands

- Run All Tests: `npm test`
- Run Frontend Tests: `npm run test:frontend` (uses vitest.config.ts)
- Run Worker Tests: `npm run test:workers` (uses workers/vitest.config.ts)
- Run E2E Tests: `npm run test:e2e` or `npx playwright test`
- Run Specific Unit Test: `npx vitest run {test_file_path}`
- Run Specific E2E Test: `npx playwright test {spec_file_path}`
- Run E2E Tests in UI Mode: `npx playwright test --ui`
- Run E2E Tests with Debug: `npx playwright test --debug`
- Run with UI: `npx vitest --ui`
- Run with Coverage: `npx vitest --coverage`
- Run in Watch Mode: `npx vitest` (without --run flag)
- Run with Verbose Output: `npx vitest run --reporter=verbose`

## Environment

- Node.js Environment
- TypeScript Support: Yes
- Test Runner: Vitest with Happy DOM for frontend
- Worker Testing: @cloudflare/vitest-pool-workers
- E2E Testing: Playwright

## Test Runner Agent Configuration

- Use verbose output for debugging: `--reporter=verbose`
- Run tests sequentially with `--run` flag (no watch mode)
- Capture full stack traces with `--reporter=verbose`
- No mocking - use real implementations
- Wait for each test to complete before moving to next
- For failed tests, analyze test structure before assuming code issues
- Use `--no-coverage` to speed up test runs when coverage not needed
- For workers: Must run from workers directory with `cd workers && npx vitest`

## Validation Status

✅ Vitest installed and working (v3.2.4)
✅ Playwright installed and configured (v1.54.2)
✅ All test dependencies installed
✅ Frontend tests running successfully
✅ Worker tests running successfully
✅ E2E tests found in `./e2e/` directory (16+ spec files)
✅ Total 95+ test files discovered (79 unit + 16+ e2e)
