---
created: 2025-08-21T17:53:12Z
last_updated: 2025-08-21T17:53:12Z
version: 1.0
author: Claude Code PM System
---

# Project Style Guide

## Code Philosophy
- **Clarity over cleverness:** Write code that is easy to understand
- **Consistency over personal preference:** Follow established patterns
- **Explicit over implicit:** Make intentions clear
- **Simple over complex:** Choose the simplest solution that works
- **Tested over assumed:** Verify behavior with tests

## File Naming Conventions

### General Rules
- **Files:** `kebab-case.ts` (all lowercase with hyphens)
- **Test Files:** `*.test.ts` or `*.spec.ts`
- **Config Files:** `*.config.ts` or `*.config.js`
- **Contract Files:** `*.contract.ts` (Zod schemas)
- **Style Files:** `*.module.css` (CSS modules)

### Examples
```
✅ Good:
- user-profile.ts
- auth-client.test.ts
- oauth.contract.ts
- button.module.css

❌ Bad:
- UserProfile.ts
- authClient_test.ts
- OAUTH_CONTRACT.ts
- Button.CSS
```

## TypeScript Conventions

### Type Definitions
```typescript
// Interfaces for object shapes
interface UserProfile {
  id: string;
  username: string;
  email: string;
}

// Types for unions and primitives
type Status = 'pending' | 'active' | 'inactive';
type UserId = string;

// Enums sparingly, prefer const objects
const Status = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const;
```

### Function Signatures
```typescript
// Named functions for top-level
function processUser(user: User): ProcessedUser {
  return transform(user);
}

// Arrow functions for callbacks and inline
const users = data.map((user) => processUser(user));

// Async/await over promises
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}
```

### Variable Naming
```typescript
// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';

// Variables: camelCase
let userCount = 0;
const isAuthenticated = true;

// Private members: underscore prefix
class Service {
  private _cache: Map<string, any>;
}

// Boolean variables: is/has/should prefix
const isLoading = false;
const hasPermission = true;
const shouldRetry = false;
```

## Component Standards

### Web Component Structure
```typescript
export class MyComponent extends BaseComponent {
  private _state: ComponentState;
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  connectedCallback(): void {
    this.render();
    this.attachEventListeners();
  }
  
  disconnectedCallback(): void {
    this.cleanup();
  }
  
  private render(): void {
    this.shadowRoot!.innerHTML = this.template();
  }
  
  private template(): string {
    return `<div class="component">Content</div>`;
  }
}

customElements.define('my-component', MyComponent);
```

### CSS Module Structure
```css
/* Component container */
.component {
  display: block;
  padding: 1rem;
}

/* Component elements */
.component__header {
  margin-bottom: 1rem;
}

.component__body {
  flex: 1;
}

/* Component modifiers */
.component--active {
  border-color: var(--color-primary);
}

/* Component states */
.component:hover {
  background-color: var(--color-hover);
}
```

## API Design Standards

### Route Naming
```typescript
// RESTful conventions
app.get('/api/users', listUsers);
app.get('/api/users/:id', getUser);
app.post('/api/users', createUser);
app.put('/api/users/:id', updateUser);
app.delete('/api/users/:id', deleteUser);

// Action-based routes
app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.post('/api/users/:id/activate', activateUser);
```

### Response Format
```typescript
// Success response
{
  success: true,
  data: {
    user: { id: '123', name: 'John' }
  }
}

// Error response
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid username format'
  }
}
```

### Error Handling
```typescript
// Use custom error classes
class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Consistent error codes
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;
```

## Testing Standards

### Test Structure
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const userData = { username: 'testuser', email: 'test@example.com' };
      
      // Act
      const user = await userService.createUser(userData);
      
      // Assert
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
    });
    
    it('should throw error for invalid email', async () => {
      // Test error cases
    });
  });
});
```

### Test Naming
```typescript
// Descriptive test names
✅ 'should return user profile when authenticated'
✅ 'should throw ValidationError for invalid email format'
✅ 'should retry failed requests up to 3 times'

// Avoid vague names
❌ 'test user creation'
❌ 'works correctly'
❌ 'handles errors'
```

## Git Conventions

### Branch Naming
```bash
feature/add-user-profile
fix/oauth-redirect-issue
refactor/simplify-auth-flow
docs/update-readme
test/add-e2e-tests
```

### Commit Messages
```bash
# Format: <type>: <description>

feat: add user profile management
fix: resolve OAuth redirect loop
refactor: simplify authentication middleware
docs: update API documentation
test: add unit tests for user service
style: format code with prettier
chore: update dependencies
```

## Documentation Standards

### Code Comments
```typescript
// Use comments sparingly, prefer self-documenting code
// When needed, explain WHY not WHAT

// Bad: Increment counter by 1
counter++;

// Good: Retry count for transient failures
retryCount++;

// Document complex algorithms
/**
 * Implements exponential backoff with jitter
 * to avoid thundering herd problem
 */
function calculateBackoff(attempt: number): number {
  const base = Math.pow(2, attempt) * 1000;
  const jitter = Math.random() * 1000;
  return Math.min(base + jitter, MAX_BACKOFF);
}
```

### JSDoc for Public APIs
```typescript
/**
 * Creates a new user profile
 * @param data - User profile data
 * @returns Created user profile
 * @throws {ValidationError} If data is invalid
 */
export async function createUser(data: UserInput): Promise<User> {
  // Implementation
}
```

## Security Standards

### Input Validation
```typescript
// Always validate input
const schema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  age: z.number().min(13).max(120)
});

const validated = schema.parse(input);
```

### Sensitive Data
```typescript
// Never log sensitive data
logger.info('User login', { username: user.username }); // ✅
logger.info('User login', { password: user.password }); // ❌

// Use environment variables for secrets
const apiKey = process.env.API_KEY; // ✅
const apiKey = 'sk-1234567890'; // ❌
```

## Performance Guidelines

### Optimization Principles
- Measure before optimizing
- Optimize hot paths first
- Prefer algorithmic improvements
- Cache expensive operations
- Lazy load when possible

### Code Patterns
```typescript
// Memoization for expensive calculations
const memoizedFn = memoize(expensiveCalculation);

// Debouncing for event handlers
const debouncedSearch = debounce(search, 300);

// Lazy loading for components
const LazyComponent = () => import('./heavy-component');
```

## Accessibility Standards

### HTML Semantics
```html
<!-- Use semantic HTML -->
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/home">Home</a></li>
  </ul>
</nav>

<!-- Provide ARIA labels -->
<button aria-label="Close dialog" aria-pressed="false">
  <svg>...</svg>
</button>

<!-- Include skip links -->
<a href="#main" class="skip-link">Skip to main content</a>
```

### Keyboard Navigation
```typescript
// Support keyboard interaction
element.addEventListener('keydown', (e) => {
  switch(e.key) {
    case 'Enter':
    case ' ':
      handleActivation();
      break;
    case 'Escape':
      handleClose();
      break;
  }
});
```

## Review Checklist

Before submitting code:
- [ ] Code follows naming conventions
- [ ] Tests are written and passing
- [ ] No console.logs in production code
- [ ] Error handling is comprehensive
- [ ] Security considerations addressed
- [ ] Performance impact considered
- [ ] Documentation updated if needed
- [ ] Accessibility requirements met
- [ ] Code is formatted consistently
- [ ] No TODO comments remaining