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

**Implementation details in `docs/technicals/frontend_migration.md`**

### Story 1.4: CSS Architecture and Organization
**Status:** ✅ **Completed**

**As a developer, I want organized, maintainable CSS that follows component architecture principles.**

**Overview:** Extract CSS from the monolithic `<style>` block in `index.html` into a well-organized file structure that mirrors the TypeScript component architecture. This improves maintainability, reduces index.html complexity, and makes styles easier to locate and modify.

**Acceptance Criteria:**
- **Organized File Structure**: CSS organized into logical files by component and functionality
- **No Visual Regression**: All existing styling and functionality preserved identically
- **Maintainable Architecture**: Easy to find and modify component-specific styles
- **Clean HTML**: index.html uses single CSS import instead of large `<style>` block
- **Build Integration**: CSS files properly included in build process

**Implementation details in `docs/technicals/ui_ux_patterns.md`**

### BUG: Instructions Modal Line Numbers Overflow and Scrolling
**Status:** ✅ **Completed**

**Issue:** Line numbers overflowed container boundaries and remained statically positioned while diff content scrolled.

**Solution details in `docs/technicals/bug_fixes.md`**

### Story 1.5: Multi-post navigation and architecture
**Status:** ⏳ **Pending**

**As a reader, I want to navigate through multiple posts with URLs and not just the latest post**
