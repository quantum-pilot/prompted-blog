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

### Story 1.4: Multi-post navigation and architecture
**Status:** ⏳ **Pending**

**As a reader, I want to navigate through multiple posts with URLs and not just the latest post**
