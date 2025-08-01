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

## Quick Reference
- **diff2html issues:** Check diff header generation
- **CSS overflow:** Look for `white-space: nowrap` 
- **Mobile layout:** Test portrait orientation and viewport height limits
- **Button positioning:** Use absolute positioning within existing containers
- **iPad scrolling:** Check viewport height constraints and orientation-based layouts
