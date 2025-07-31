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
