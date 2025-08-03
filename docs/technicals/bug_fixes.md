# Bug Fixes & Solutions

## Common Problem Patterns

### diff2html Integration Issues
**Problem:** Line number misalignment when displaying full file content
**Root Cause:** Missing proper diff headers for unchanged files
**Solution:** Generate dummy diff headers: `@@ -1,${lines.length} +1,${lines.length} @@`

### UI Element Positioning
**Problem:** Buttons covering content or being inaccessible
**Solution:** Use absolute positioning within existing containers (d2h-file-header)

### File Revision Logic
**Problem:** Complex logic to match file versions across revisions
**Solution:** Merge all revisions by date, find most recent version per file, fallback to previous revision

## CSS Display Issues

### Word Wrap Problems
**Root Cause:** `white-space: nowrap` breaks natural text flow and causes overflow
**Key Insight:** Use `white-space: initial` and `display: inline` to preserve natural wrapping
**Files:** Components with diff viewers and modals

### Mobile Responsiveness
**Root Cause:** Desktop-sized elements don't work on mobile (44px+ buttons, tall containers)
**Key Insights:**
- Touch targets need 36-44px minimum size
- Tablet landscape has viewport height constraints (768px)
- Orientation-based layouts work better than width-only breakpoints
**Files:** `navigation.css`, `diff-viewer.css`

### Mobile Navigation and iPad Layout
**Root Cause:** Desktop-sized navigation elements and viewport height constraints on tablets
**Key Insights:**
- Mobile touch targets should be 36px minimum (not 44px+ desktop sizes)
- iPad landscape (1024x768) has strict viewport height limits requiring 54vh max for diff containers
- Orientation-based layouts work better than width-only breakpoints for responsive design
- Portrait mode should always use tab layout regardless of screen width
**Files:** `navigation.css`, `diff-viewer.css`

### Dark Theme Diff Colors Too Bright
**Root Cause:** Bright green (#97f295) and red (#ffb6ba) word-level highlights were harsh and didn't match GitHub's subtle styling
**Key Insights:**
- GitHub uses much darker, eye-friendly colors for diff highlights (#3a5a3d for additions, #5a3a3d for deletions)
- Line numbers should match word-level highlights for cohesive appearance
- Major CSS cleanup opportunity: ~200 lines of redundant CSS eliminated while maintaining functionality
**Files:** `theme.css`, `diff2html-dark-overrides.css`

### Theme Manager Not Initializing on Page Load
**Root Cause:** Theme manager singleton was imported but never actually instantiated during module loading
**Key Insights:**
- Simply importing the theme manager module doesn't trigger constructor execution
- Theme manager needs to be explicitly accessed to create the singleton instance
- Moving theme manager import to top of main.ts and accessing the instance forces proper initialization
- The `data-theme` attribute is critical for diff2html dark theme overrides to work properly
**Files:** `main.ts`, `theme-manager.ts`

### Theme Toggle Button Multiple Issues
**Root Cause:** Multiple styling conflicts between button system and theme toggle requirements - button system's `.icon-only` class enforced 44px width but theme toggle needed space for two icons, plus base button styles applied unwanted background/border styling
**Key Insights:**
- Theme toggle requires different styling approach than standard buttons due to custom track design
- CSS specificity must be increased with `.theme-toggle.icon-only` selector and `!important` declarations
- Icon positioning requires mathematical precision across responsive breakpoints to prevent overflow
- Desktop optimal spacing: 4px gap between icons, mobile requires 8px spacing in smaller tracks
**Files:** `blog-header.css`

### Single Line Numbers for Non-Diff Content
**Root Cause:** When displaying content with no diff (unchanged files), diff2html still shows dual line numbers creating confusing UX
**Key Insights:**
- Adding CSS class `diff-unchanged` to container allows targeted styling for non-diff content
- Hiding `.line-num1` elements removes the redundant first column for cleaner display
- Mobile optimization requires reducing line number column widths to prevent overflow
- Simple CSS-only solution avoids complex JavaScript modifications
**Files:** `diff-renderer.ts`, `diff-viewer.css`

### Instructions Button and Modal Styling
**Root Cause:** CSS specificity conflicts between button design system and instructions button requirements, plus modal layout constraints
**Key Insights:**
- Generic button rules can override specific component styling without proper specificity
- Instructions button requires exemption from standard secondary button styling to maintain yellow highlight
- Modal line number overflow requires careful width management in desktop views
- Close button addition improves modal UX without complex JavaScript changes
**Files:** `buttons.css`, `diff-viewer.css`, `instructions-modal.ts`

## Quick Reference
- **diff2html issues:** Check diff header generation and line number display configuration
- **CSS overflow:** Look for `white-space: nowrap` 
- **Mobile layout:** Test portrait orientation and viewport height limits
- **Button positioning:** Use absolute positioning within existing containers
- **iPad scrolling:** Check viewport height constraints and orientation-based layouts
- **Dark theme colors:** Use GitHub's actual rgba values for professional diff styling
- **Theme initialization:** Ensure theme manager singleton is accessed during module import
- **CSS specificity:** Increase selector specificity to override system constraints when needed
- **Single line numbers:** Add `diff-unchanged` class and hide `.line-num1` for non-diff content
- **Button styling conflicts:** Check specificity and use exclusions in generic selectors
