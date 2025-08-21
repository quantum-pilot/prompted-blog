---
created: 2025-08-21T17:53:12Z
last_updated: 2025-08-21T17:53:12Z
version: 1.0
author: Claude Code PM System
---

# System Patterns

## Architectural Patterns

### Overall Architecture
- **Pattern:** Modular Monorepo with Clear Boundaries
- **Style:** Component-Based Frontend, Service-Oriented Backend
- **Deployment:** Edge-First with Cloudflare Workers
- **Data Flow:** Unidirectional with Contract-Driven APIs

### Frontend Patterns

#### Web Components Architecture
- **Base Class Pattern:** All components extend `BaseComponent`
- **Lifecycle Management:** Constructor → connectedCallback → cleanup
- **Event Handling:** Centralized EventManager with automatic cleanup
- **Style Encapsulation:** CSS Modules with component scoping

```typescript
// Pattern: Component inheritance
class Component extends BaseComponent {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }
}
```

#### State Management
- **Pattern:** Local Component State
- **Updates:** Direct DOM manipulation
- **Events:** Custom events for inter-component communication
- **No Global Store:** Intentional simplicity

#### Routing Pattern
- **Client-Side Router:** Custom implementation with pattern matching
- **Route Guards:** Authentication checks before navigation
- **Dynamic Loading:** Components loaded on demand

### Backend Patterns

#### Middleware Pipeline
- **Pattern:** Layered Middleware Stack
- **Order:** CORS → Security → RateLimit → Auth → Routes
- **Context Propagation:** RequestContext passed through pipeline
- **Error Boundary:** Global error handler catches all exceptions

```typescript
// Pattern: Middleware composition
app.use(corsMiddleware())
   .use(securityMiddleware())
   .use(rateLimitMiddleware())
   .use(authMiddleware())
   .route('/api', apiRoutes)
```

#### Request Context Pattern
- **Singleton per Request:** RequestContext initialized once
- **Audit Trail:** All operations logged with context
- **Error Tracking:** Errors linked to request context
- **Performance Monitoring:** Request timing tracked

#### Service Layer Pattern
- **KV Store Abstraction:** `KVStore` class wraps Cloudflare KV
- **Error Handling:** `ErrorHandler` centralizes error management
- **Audit Service:** `AuditService` for operation logging

### Data Patterns

#### Contract-First Design
- **Zod Schemas:** Define API contracts
- **Type Inference:** TypeScript types from schemas
- **Runtime Validation:** Input/output validation
- **Shared Contracts:** Frontend/backend share schemas

```typescript
// Pattern: Contract definition
const schema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email()
});
type User = z.infer<typeof schema>;
```

#### Storage Patterns
- **Session Storage:** KV with TTL for sessions
- **Atomic Operations:** Username reservation with locks
- **Key Namespacing:** Prefixed keys for organization
- **Cache Strategy:** Edge caching for static assets

### Security Patterns

#### Authentication Flow
- **OAuth 2.0 + PKCE:** Industry standard with extra security
- **State Management:** CSRF protection via state parameter
- **Session Fixation Prevention:** New session on login
- **Cookie Security:** HttpOnly, Secure, SameSite flags

#### Defense in Depth
- **Multiple Layers:** Each layer adds security
- **Fail Secure:** Deny by default on errors
- **Input Validation:** Client and server validation
- **Output Encoding:** XSS prevention

### Error Handling Patterns

#### Error Classification
- **User Errors:** 4xx with helpful messages
- **System Errors:** 5xx with generic messages
- **Validation Errors:** Detailed field-level errors
- **Rate Limit Errors:** Retry-After headers

#### Error Recovery
- **Graceful Degradation:** Features degrade safely
- **Retry Logic:** Exponential backoff for transient errors
- **Circuit Breaker:** Prevent cascade failures
- **Fallback Responses:** Cached or default responses

### Testing Patterns

#### Test Organization
- **Unit Tests:** Component and utility testing
- **Integration Tests:** API endpoint testing
- **E2E Tests:** User journey testing
- **Test Fixtures:** Shared test data and helpers

#### Test-Driven Development
- **Red-Green-Refactor:** Write failing test first
- **Coverage Goals:** Critical paths fully covered
- **Mock Strategy:** Minimal mocking, prefer real implementations
- **Test Isolation:** Each test independent

### Code Organization Patterns

#### Module Boundaries
- **Clear Separation:** Frontend/Backend/Shared
- **Dependency Direction:** Shared ← Frontend/Backend
- **No Circular Dependencies:** Enforced by structure
- **Interface Segregation:** Small, focused interfaces

#### Naming Conventions
- **Files:** kebab-case for consistency
- **Classes:** PascalCase for components
- **Functions:** camelCase for methods
- **Constants:** UPPER_SNAKE_CASE for globals

### Performance Patterns

#### Optimization Strategies
- **Code Splitting:** Component-based bundles
- **Lazy Loading:** Load on demand
- **Edge Caching:** Static assets cached at edge
- **Minification:** Production builds optimized

#### Resource Management
- **Event Cleanup:** Automatic listener removal
- **Memory Management:** Proper disposal patterns
- **Connection Pooling:** Reuse database connections
- **Request Batching:** Combine related requests

### Deployment Patterns

#### CI/CD Pipeline
- **Automated Testing:** Tests run on every commit
- **Build Validation:** Structure validation pre-deploy
- **Staged Rollout:** Dev → Staging → Production
- **Rollback Strategy:** Quick revert capability

#### Environment Management
- **Configuration:** Environment-specific settings
- **Secrets Management:** Wrangler secrets for sensitive data
- **Feature Flags:** Gradual feature rollout
- **Monitoring:** Logging and metrics collection

## Anti-Patterns to Avoid

### Code Anti-Patterns
- ❌ Global variables and singletons (except services)
- ❌ Callback hell (use async/await)
- ❌ Large monolithic components
- ❌ Direct DOM manipulation outside components
- ❌ Mixing concerns (UI logic in API handlers)

### Security Anti-Patterns
- ❌ Storing secrets in code
- ❌ Client-side security validation only
- ❌ Predictable tokens or IDs
- ❌ Verbose error messages in production

### Testing Anti-Patterns
- ❌ Testing implementation details
- ❌ Excessive mocking
- ❌ Dependent tests
- ❌ Ignoring edge cases