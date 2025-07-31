## Phase 1: Core Blog Engine (Current State)

### Story 1.1: Basic Blog Structure
**Status:** ✅ **Completed**

**As a reader, I want markdown render of every post with the latest post in homepage.**

**Overview:** Core blog infrastructure with post generation and serving.

**Current Implementation:**
- `index.html` - Main blog interface with GitHub-style markdown rendering
- `assets/main.js` - Client-side logic for post loading and diff visualization
- `engine/generate.py` - Server-side diff cache generation from git history
- `engine/render.sh` - Markdown to HTML conversion using GitHub-flavored styling
- Post structure: `posts/YYYY-MM-DD/` with `prompts.txt`, `output.md`, and `diff_cache/`

### Story 1.2: Diff History Visualization
**Status:** ✅ **Completed**

**As a reader, I want diffs of prompts and outputs shown side-by-side in history view with instructions diff as an overlay.**

**Overview:** Interactive diff viewer showing evolution of prompts, instructions, and outputs.

**Current Implementation:**
- Three-file diff view: Instructions (overlay), Prompts (left), Output (right)
- Revision scroller with dots for navigating through git commit history
- Uses diff2html for professional diff rendering
- Auto-scroll to first change when viewing diffs
- File headers stay fixed while content scrolls

### Story 1.3: TypeScript and Web Components Migration
**Status:** ✅ **Completed**

**As a developer, I want clean and maintainable code using TypeScript and Web Components as building blocks.**

**Overview:** Refactor the monolithic `main.js` into modular, type-safe TypeScript components following Plain Vanilla Web principles. This improves maintainability, debugging, and code reuse while preserving all existing functionality.

**Acceptance Criteria:**
- **Type Safety**: All data structures, API responses, and DOM interactions are properly typed
- **Component Separation**: UI logic is separated into reusable Web Components with clear interfaces
- **Preserved Functionality**: All existing features work identically (diff view, revision scroller, instructions modal, auto-scroll)
- **Build Process**: Simple build setup (npm/pnpm) that compiles TypeScript and serves the application
- **Code Organization**: Logical file structure with clear separation of concerns
- **No Framework Dependencies**: Maintains vanilla JS approach with TypeScript and Web Components only

**Technical Implementation:**
- **Package Manager**: Use npm or pnpm for dependency management and build scripts
- **TypeScript Configuration**: Strict mode with proper DOM types and module resolution
- **Component Architecture**:
  - `<blog-header>` - Header with history toggle button
  - `<post-viewer>` - Latest post rendering component
  - `<diff-viewer>` - Two-pane diff visualization component (Prompts | Output)
  - `<revision-scroller>` - Dot navigation component
  - `<instructions-modal>` - Floating instructions overlay
- **Service Layer**: Separate modules for API calls, diff processing, and URL state management
- **Type Definitions**: Interfaces for revision data, file metadata, and component props
- **Build Target**: Modern browsers (ES2020+) to keep bundle small and avoid transpilation overhead

**Testing:**
- **Functional Testing**: Verify all existing features work after migration using browser automation
- **Cross-browser Testing**: Test in Chrome, Firefox, Safari to ensure Web Components compatibility
- **Performance Testing**: Ensure bundle size and runtime performance remain comparable
- **Build Testing**: Verify clean builds with no TypeScript errors or warnings
- **Manual Testing**: Test all user interactions (history toggle, revision navigation, instructions modal, auto-scroll)

### Story 1.4: CSS Architecture and Organization
**Status:** ⏳ **Pending**

**As a developer, I want organized, maintainable CSS that follows component architecture principles.**

**Overview:** Extract CSS from the monolithic `<style>` block in `index.html` into a well-organized file structure that mirrors the TypeScript component architecture. This improves maintainability, reduces index.html complexity, and makes styles easier to locate and modify.

**Acceptance Criteria:**
- **Organized File Structure**: CSS organized into logical files by component and functionality
- **No Visual Regression**: All existing styling and functionality preserved identically
- **Maintainable Architecture**: Easy to find and modify component-specific styles
- **Clean HTML**: index.html uses single CSS import instead of large `<style>` block
- **Build Integration**: CSS files properly included in build process

**Technical Implementation:**
- **File Structure**:
  ```
  assets/css/
  ├── main.css                    # Entry point, imports all files
  ├── base.css                    # Global styles (body, typography)
  ├── layout.css                  # Overall layout and positioning
  └── components/
      ├── blog-header.css         # Header, title, history button
      ├── post-viewer.css         # Post content styling
      ├── diff-viewer.css         # Diff containers, headers, scrolling
      ├── revision-scroller.css   # Dot navigation
      ├── instructions-modal.css  # Modal overlay and content
      └── navigation.css          # Prev/next buttons
  ```
- **CSS Import Strategy**: Use `@import` statements in `main.css` to load component files
- **Build Process**: Update npm scripts to copy CSS files to dist/
- **HTML Cleanup**: Replace `<style>` block with `<link rel="stylesheet" href="assets/css/main.css">`

**Testing:**
- **Visual Regression Testing**: Verify all components look and behave identically
- **Cross-browser Testing**: Ensure CSS imports work correctly in all browsers
- **Build Testing**: Verify CSS files are properly copied and accessible
- **Component Testing**: Test each component's styling in isolation
- **Integration Testing**: Verify no style conflicts or missing imports

### Story 1.5: Multi-post navigation and architecture
**Status:** ⏳ **Pending**

**As a reader, I want to navigate through multiple posts with URLs and not just the latest post**
