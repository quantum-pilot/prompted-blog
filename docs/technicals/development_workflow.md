
## Development Workflow

### Local Development
1. Make content changes and commit to git
2. Run `python engine/generate.py` and `./engine/render.sh` (generates posts.json automatically)
3. Build TypeScript: `npm run build`
4. Do not run `npm run dev` - assume server always runs on http://localhost:8000 with caching disabled

### TypeScript Development
- Build: `npm run build` 

See [frontend_migration.md](./frontend_migration.md) for TypeScript migration details.

### Testing
Manual testing across browsers and mobile devices, focusing on diff2html integration and git history edge cases.

### Documentation Maintenance
Documentation maintenance is handled by the Documentation Agent. See `docs/team.md` for complete process.

### Bug Fix Documentation Process
When bugs are discovered and fixed, follow the process outlined in `docs/team.md` section "One-Off Bug Fix Process".

### UI Development Standards

#### UI Testing and Verification Workflow
1. **Always verify visually**: Take screenshots before/after every UI change, don't rely solely on measurements
2. **Use specific CSS selectors**: Increase CSS specificity when system styles need overriding
3. **Measure actual rendered dimensions**: Use browser dev tools to verify real positioning, not just CSS values
4. **Test responsive breakpoints**: Ensure fixes work across all screen sizes with proportional adjustments
