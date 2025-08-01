## UI/UX Patterns

*Note: TypeScript Component UX patterns are documented in [Frontend Migration](./frontend_migration.md)*

## CSS Architecture and Organization (Story 1.4)

### Architecture Decision: Component-Based CSS Structure

**Problem:** Monolithic `<style>` block in `index.html` made CSS difficult to maintain and locate component-specific styles.

**Solution:** Extracted CSS into organized file structure mirroring TypeScript component architecture:

```
assets/css/
├── main.css                    # Entry point with @import statements
├── base.css                    # Global styles (body, typography, diff2html overrides)
├── layout.css                  # Overall layout and positioning
└── components/
    ├── blog-header.css         # Header, title, history button
    ├── post-viewer.css         # Post content styling  
    ├── diff-viewer.css         # Diff containers, headers, scrolling
    ├── revision-scroller.css   # Dot navigation
    ├── instructions-modal.css  # Modal overlay and content
    └── navigation.css          # Prev/next buttons
```

**Benefits:**
- Easy to locate component-specific styles
- Maintainable architecture that scales with component growth
- Clean separation of concerns
- Build process automatically includes all CSS files

### Diff Rendering: Unified Format

**Decision:** Use unified (line-by-line) diff format for better mobile experience and consistent display across all components.

**Implementation:** Shared `DiffRenderer` service with `outputFormat: 'line-by-line'`.

### Instructions Modal Architecture

Modal reuses shared `DiffRenderer` service and `.diff-container` behavior for consistency with main panels.

Key pattern: `#instructions-content` uses flex layout with `overflow-y: auto` for proper scrolling.