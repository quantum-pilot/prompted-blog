## UI/UX Patterns

*Note: TypeScript Component UX patterns are documented in [Frontend Migration](./frontend_migration.md)*

## CSS Architecture Principles (Story 1.4)

### Component-Based CSS Structure
**Decision:** Extracted monolithic CSS into organized file structure mirroring TypeScript components.

**Key Principle:** Each component gets its own CSS file for maintainable architecture that scales.

**Benefits:**
- Easy to locate component-specific styles
- Clean separation of concerns
- Scales with component growth

### Diff Rendering Format
**Decision:** Use unified (line-by-line) diff format for better mobile experience and consistent display.

**Lesson Learned:** Consistency across components is more valuable than format variety.

## Mobile-First Design Principles (Story 2.1)

### Responsive Breakpoint Strategy
**Standard Breakpoints:**
- **Mobile:** ≤768px 
- **Tablet:** 769px-1024px
- **Desktop:** ≥1025px

**Key Decision:** CSS-only responsive design over JavaScript viewport detection for better performance.

### Progressive Enhancement Philosophy
**Principle:** Desktop-first functionality with mobile-specific optimizations.

**Pattern:** Dual rendering paths within components:
- Mobile: Tabbed interface for space constraints
- Desktop: Side-by-side layout for comprehensive comparison

### Touch-Friendly Standards
**Rule:** Minimum 44px touch targets for all interactive elements.

**Design Principle:** Every UI element evaluated for necessity on small screens - hide non-essential elements to maximize content space.

## Header Architecture Patterns (Story 2.2)

### Separation of Concerns
**Key Decision:** Architectural separation of header and navigation into distinct areas.

**Problem Solved:** Single-component headers cause content overlap on small screens.

**Solution Pattern:** Header for branding/controls, separate navigation bar for actions.

### Mobile Navigation Strategy
**Decision:** Full-text buttons over icons on mobile.

**Rationale:** Mobile users benefit from clear action labels despite limited space.

## Continuous Line Navigation (Story 2.3)

### Mathematical Positioning Algorithm
**Core Innovation:** `position = (index / (total-1)) * 100%` for equidistant spacing.

**Key Benefit:** Scales from 2 to 100+ revisions without interface degradation.

### Responsive Positioning Strategy
**Mobile Pattern:** Bottom-left positioning for thumb accessibility.
**Desktop Pattern:** Bottom-center positioning for balanced layout.

**Design Principle:** Each screen size gets positioning optimized for primary interaction method (thumb vs mouse).

### Drag Interaction Design
**Key Decision:** Support both touch and mouse with unified event handling.

**Performance Principle:** Live preview during drag with snap-to-revision for precision.

## Theme System Architecture (Story 2.4)

### CSS Custom Properties Foundation
**Core Decision:** CSS custom properties (variables) for comprehensive theming system.

**Key Benefits:**
- Maximum flexibility and performance
- Real-time theme switching without page reload
- Maintainable color palette management

### Theme Detection Hierarchy
**Implementation Strategy:** Three-tier preference system:
1. localStorage (user explicit choice)
2. System preference (prefers-color-scheme)
3. Default light theme

**Rationale:** Respects user agency while providing sensible defaults.

### Theme State Management
**Pattern:** Data attribute approach on document root (`data-theme="dark"`).

**Technical Decision:** Avoids CSS media query conflicts and enables programmatic control.

### Color Palette Strategy
**Design Principle:** Semantic color variables that inherit from base theme variables.

**Key Variables:**
- `--bg-primary` / `--bg-secondary` for backgrounds
- `--text-primary` / `--text-secondary` for content
- `--border-color` for structural elements
- `--accent-blue` for interactive elements

### Diff Theme Integration
**Challenge:** Override diff2html's default styling for dark theme compatibility.

**Solution:** Separate override file (`diff2html-dark-overrides.css`) with GitHub's actual dark theme colors.

**Key Insight:** Using actual GitHub rgba values creates professional, eye-friendly diff styling.

## Key Lessons Learned

### Responsive Design
1. **Mobile-first CSS** is more maintainable than desktop-first
2. **44px touch targets** are non-negotiable for usability
3. **Progressive enhancement** maintains functionality across devices
4. **Component separation** prevents mobile layout conflicts

### Interaction Design
1. **Mathematical algorithms** enable scalable UI patterns
2. **Visual feedback** (transitions, hover states) improves perceived performance
3. **Unified event handling** reduces code complexity and bugs
4. **Clear action labels** beat cryptic icons on mobile

### Architecture Principles
1. **Single source of truth** for each UI pattern
2. **Component-based CSS** mirrors TypeScript architecture
3. **Separation of concerns** prevents feature conflicts
4. **Performance over convenience** in responsive design choices