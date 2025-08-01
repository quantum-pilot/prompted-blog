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

**Implementation details in `docs/technicals/frontend_migration.md`**

### Story 1.4: CSS Architecture and Organization
**Status:** ✅ **Completed**

**As a developer, I want organized, maintainable CSS that follows component architecture principles.**

**Overview:** Extract CSS from the monolithic `<style>` block in `index.html` into a well-organized file structure that mirrors the TypeScript component architecture. This improves maintainability, reduces index.html complexity, and makes styles easier to locate and modify.

**Implementation details in `docs/technicals/ui_ux_patterns.md`**

### BUG: Instructions Modal Line Numbers Overflow and Scrolling
**Status:** ✅ **Completed**

**Issue:** Line numbers overflowed container boundaries and remained statically positioned while diff content scrolled.

**Solution details in `docs/technicals/bug_fixes.md`**

### Story 1.5: Multi-post navigation and architecture
**Status:** ⏳ **Pending**

**As a reader, I want to navigate through multiple posts with URLs and not just the latest post**

**Overview:** Implement hash-based routing for individual posts and improve navigation between posts. This enables direct linking to specific posts while maintaining the single-page application architecture.

**Acceptance Criteria:**
- **Hash-based Routing**: Posts accessible via `#/posts/YYYY-MM-DD/` URLs
- **Homepage Behavior**: Root URL (`/` or `#/`) loads latest post and updates URL to its specific path
- **Navigation Controls**: Previous/Next buttons moved to header, disabled when no more posts in that direction
- **URL Persistence**: Browser back/forward buttons work correctly with post navigation
- **Smooth Transitions**: Page updates in-place without full reload when navigating between posts
- **Deep Linking**: Users can bookmark and share specific post URLs
- **History Mode Support**: Hash URLs work correctly in both normal and history diff view modes

**Technical Implementation:**
- **UrlService Enhancement**: Add hash change listener and routing logic for `#/posts/YYYY-MM-DD/` pattern
- **ApiService Update**: Add methods to fetch post list and navigate between posts
- **Header Component**: Integrate prev/next navigation buttons with proper disabled states
- **AppCoordinator**: Handle routing events and coordinate component updates
- **Post Loading**: Update post viewer to load specific posts based on URL

**Testing Requirements:**
- Navigate to root URL and verify it loads latest post with correct URL
- Click previous/next buttons and verify smooth navigation
- Test disabled state at first/last post
- Use browser back/forward buttons to verify history works
- Direct link to specific post URL and verify it loads correctly
- Switch between normal and history mode on different posts
- Test with posts that don't exist (handle 404 gracefully)
