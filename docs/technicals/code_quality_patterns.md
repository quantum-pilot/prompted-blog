# Code Quality Patterns

## Memory Management and Component Lifecycle

### Component Cleanup Pattern

**Problem:** Web components can create memory leaks through event listeners that persist after component removal.

**Solution:** Systematic cleanup with tracked event listeners pattern established in Story 2.1.1:

```typescript
class SampleComponent extends HTMLElement {
  private eventListeners: Array<{ element: Element; event: string; handler: EventListener }> = [];

  connectedCallback() {
    // Setup and track listeners
    const handler = this.handleClick.bind(this);
    document.addEventListener('click', handler);
    this.eventListeners.push({ element: document, event: 'click', handler });
  }

  disconnectedCallback() {
    this.cleanup();
  }

  private cleanup() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
}
```

**Benefits:**
- Prevents memory leaks in single-page applications
- Systematic cleanup ensures no orphaned listeners
- Easy to track and debug event management

## Centralized Error Handling System

### ErrorHandler Pattern

**Problem:** Inconsistent error handling across components led to poor user experience and debugging difficulties. Previously, components used raw `console.error()` calls which provided no user feedback and inconsistent error reporting.

**Solution:** Centralized ErrorHandler utility (`src/utils/error-handler.ts`) with context-aware error methods:

```typescript
// Specialized error methods for different scenarios
handleApiError(error, context) // Network/API failures with user notifications
handleRenderError(error, context) // Component rendering issues with fallback content
handleNavigationError(error, context) // Navigation failures
```

**Usage Pattern:**
```typescript
return this.errorHandler.wrap(
  async () => { /* operation */ },
  { message: 'Operation description', code: 'ERROR_CODE' },
  { showUserMessage: true, fallbackValue: defaultValue }
);
```

**Implementation in ApiService:**
All ApiService methods now use ErrorHandler.wrap() instead of console.error:
- `getPostContent()` - User-friendly error with fallback HTML content
- `getDiff()` - Silent error handling with null fallback for optional diffs
- `getFileContent()` - Silent error handling with empty string fallback
- `getPostList()` - Fallback to latest post only if full list fails

**Benefits:**
- Consistent error handling across all components
- User-friendly error notifications where appropriate
- Structured error logging for debugging
- Fallback values prevent application breakage
- Eliminates raw console.error usage throughout codebase

## Type Safety Standards

### TypeScript Interface System

**Problem:** Use of `any` types reduced type safety and made debugging more difficult.

**Solution:** Comprehensive TypeScript interfaces in `src/types/index.ts`:

```typescript
interface FileInRevision {
  name: string;
  content: string;
  hasChanges: boolean;
}

interface RevisionData {
  date: string;
  files: Map<string, FileInRevision>;
}

interface AdjacentPosts {
  prev?: PostInfo;
  next?: PostInfo;
}
```

**Guidelines Established:**
- No `any` types allowed - define proper interfaces
- Use optional chaining and null checks for safety
- Type all service methods and component properties
- Maintain interface documentation in single types file

## CSS Architecture and Code Cleanliness

### CSS Class Organization

**Problem:** Inline styles scattered throughout components made maintenance difficult and violated separation of concerns.

**Solution:** Systematic extraction of styling to CSS classes with semantic naming:

**Examples of improvements:**
- `.diff-container` styles moved from inline to `diff-viewer.css`
- `.instructions-btn` styling consolidated in dedicated CSS classes
- Eliminated style attributes in favor of class-based styling

**Benefits:**
- Consistent styling patterns across components
- Easier maintenance and theme application
- Better separation of concerns (structure vs presentation)
- Improved CSS organization and readability

### Debug Statement Cleanup

**Problem:** Debug console.log statements persisted in production code, creating console noise.

**Solution:** Systematic removal of debug statements from all components:
- Removed console.log from DiffViewer `connectedCallback()`
- Ensured only intentional error logging through ErrorHandler remains

**Benefits:**
- Clean console output in production
- Reduced JavaScript execution overhead
- Professional application behavior

## Development Standards

### Quality Gates

All new code must meet these standards:

1. **Memory Management**: Components must implement `disconnectedCallback()` with cleanup
2. **Error Handling**: Use centralized ErrorHandler for all error scenarios
3. **Type Safety**: No `any` types - define proper interfaces
4. **Event Management**: Track and clean up event listeners systematically
5. **CSS Organization**: Use CSS classes instead of inline styles
6. **Debug Cleanliness**: No console.log statements in production code

### Testing Requirements

- TypeScript compilation without errors
- Memory leak prevention through proper cleanup
- Error handling functionality verification
- All existing functionality preserved during refactoring

## Code Reusability Improvements (Extension of Story 2.1.1)

### BaseComponent Architecture Pattern

**Problem:** Significant duplication across all web components for service initialization, event management, and common functionality.

**Solution:** Centralized BaseComponent class that provides common functionality and eliminates repetitive patterns:

```typescript
export abstract class BaseComponent extends HTMLElement {
  // Provides all services pre-initialized
  protected apiService: ApiService;
  protected diffRenderer: DiffRenderer;
  protected urlService: UrlService;
  protected appCoordinator: AppCoordinator;
  protected errorHandler: ErrorHandler;
  protected eventManager: EventManager;

  // Automatic event cleanup on component removal
  disconnectedCallback(): void {
    this.eventManager.cleanup();
    this.cleanup();
  }

  // Common methods for all components
  protected setVisible(visible: boolean): void;
  protected checkHistoryMode(): void;
  protected handleError(error, operation, config?): any;
}
```

**Impact Eliminated:**
- ~50 lines of duplicate service initialization across 5 components
- ~40 lines of duplicate event listener management
- ~20 lines of duplicate visibility/history mode methods
- Inconsistent error handling patterns

### EventManager Utility Pattern

**Problem:** Components had custom event listener tracking that was error-prone and led to memory leaks.

**Solution:** Centralized EventManager with automatic cleanup:

```typescript
export class EventManager {
  addEventListener(element, event, handler, options?): void;
  removeEventListener(element, event, handler, options?): void;
  cleanup(): void; // Removes all tracked listeners
}
```

**Benefits:**
- Eliminates memory leaks from orphaned event listeners
- Consistent event management across all components
- Automatic cleanup on component disconnection

### DiffRenderer.renderFileRevision Pattern

**Problem:** Identical 80+ line file rendering logic duplicated in diff-viewer and instructions-modal components.

**Solution:** Extracted centralized rendering method:

```typescript
static async renderFileRevision(
  fileName: string,
  dir: string,
  displayName: string,
  container: HTMLElement,
  revision: RevisionData,
  revisionIndex: number,
  revisions: RevisionData[],
  apiService: any
): Promise<void>
```

**Benefits:**
- Single source of truth for file revision rendering
- Consistent error handling and fallback behavior
- Easier maintenance and testing

### Component Conversion Results

All components now extend BaseComponent:
- **blog-header**: Converted to use centralized services and event management
- **diff-viewer**: Eliminated custom event tracking, uses renderFileRevision method
- **instructions-modal**: Uses renderFileRevision method, centralized event management
- **revision-scroller**: Centralized event management
- **post-viewer**: Fixed error handling consistency, centralized services

### Updated Development Standards

**Architecture Requirements:**
1. **All new components must extend BaseComponent** - No manual service initialization
2. **Use EventManager for all event listeners** - No custom event tracking arrays
3. **Use centralized error handling** - No console.error, use this.handleError()
4. **Leverage common utility methods** - setVisible(), checkHistoryMode() provided by base

**Code Duplication Prevention:**
- Before adding similar logic to multiple components, extract to BaseComponent or utility class
- Use DiffRenderer.renderFileRevision for any file content rendering
- Follow established patterns for consistency

These patterns ensure long-term maintainability and provide a solid foundation for future development while maintaining the project's simplicity principles.
