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

## Mobile-Responsive Design Patterns (Story 2.1)

### Responsive Breakpoint System

**Standard Breakpoints:**
- **Mobile:** ≤768px (320px-768px)
- **Tablet:** 769px-1024px
- **Desktop:** ≥1025px

**Implementation Pattern:** CSS-only responsive design with media queries for better performance over JavaScript viewport detection.

### Mobile-First Progressive Enhancement

**Design Philosophy:** Desktop-first functionality with mobile-specific optimizations that progressively enhance the experience on larger screens.

**Pattern:** Dual rendering paths within components:
- Mobile: Tabbed interface for space-constrained viewing
- Desktop: Side-by-side layout for comprehensive comparison

### Touch-Friendly Interaction Design

**Touch Target Standards:**
- Minimum 44px touch targets for all interactive elements
- Visual feedback with 300ms smooth transitions
- Event delegation using `e.currentTarget` for reliable click handling on nested elements

**Example Implementation:**
```css
.tab-button {
  min-height: 44px;
  min-width: 44px;
  transition: all 300ms ease;
}
```

### Mobile Tabbed Interface Pattern

**HTML Structure:**
```html
.tab-title > .tab-main > .tab-icon
```

**Key Features:**
- Flexbox column layout to prevent horizontal overflow
- Change indicator badges positioned below tab titles
- Content switching with smooth transitions
- Full-width content utilization on mobile

### Mobile Space Optimization

**Principles:**
- Every UI element evaluated for necessity on small screens
- Hide non-essential elements (e.g., d2h-file-headers) on mobile
- Overflow protection across all components
- Viewport meta tag critical for proper responsive behavior

**Essential Viewport Configuration:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### Component Architecture Extensions (Story 2.1)

**Dual Rendering Paths:** Extended diff-viewer component with conditional rendering for mobile and desktop experiences, maintaining single component architecture while providing optimized UX for each viewport.

**Responsive Design System:** Established comprehensive responsive design system with consistent breakpoints across all components, ensuring unified behavior and maintainable CSS architecture.

**Modal Integration:** Integrated instructions-modal functionality directly into mobile tab system while preserving desktop modal behavior, demonstrating pattern for progressive enhancement of complex UI components.
