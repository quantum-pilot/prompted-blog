### diff2html Line Number Issues
**Issue:** Line numbers misaligned when injecting full file content.
**Solution:** Generate proper diff headers with correct line counts.
```javascript
// For unchanged files, create dummy diff header
`@@ -1,${lines.length} +1,${lines.length} @@`
```

### Instructions Button Positioning
**Issue:** Button needs to be accessible but not cover content.
**Solution:** Position within d2h-file-header using absolute positioning.
```css
.instructions-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 10;
}
```

### Revision Fetching Logic
**Issue:** Complex logic to find correct file version for each revision.
**Solution:**
1. Merge all file revisions by date
2. For each revision, find most recent version of each file
3. Fallback to previous revision if file not changed

### CSS Display and Word Wrap Issues
**Issue:** Instructions modal and diff viewers had CSS display problems:
- Line numbers overflowed container boundaries
- Word wrap was broken by `white-space: nowrap`
- d2h-code-line elements had excessive padding

**Root Cause:** Previous CSS fixes used `white-space: nowrap` which prevented proper word wrapping and caused display issues.

**Solution Applied:**
```css
.d2h-code-line {
  padding: 0;
}

diff-viewer td {
  padding-left: 1%;
}

.d2h-code-line, .d2h-code-line-ctn {
  display: inline;
  white-space: initial;
}
```

**Key Insights:**
- `white-space: initial` preserves natural word wrapping instead of forcing `nowrap`
- `display: inline` maintains proper inline flow without breaking layout
- Minimal padding approach with targeted spacing via `padding-left: 1%`
- Global approach avoids component-specific overrides that can conflict
