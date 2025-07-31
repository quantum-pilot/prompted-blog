
## Development Workflow

### Local Development
1. Make content changes
2. Commit to git
3. Run `python engine/generate.py`
4. Run `./engine/render.sh`
5. **Build TypeScript:** `npm run build` (see [frontend_migration.md](./frontend_migration.md))
6. Serve with `python -m http.server`

### TypeScript Development
- **Dev mode:** `npm run dev` (see [frontend_migration.md](./frontend_migration.md))
- **Build:** `npm run build`
- **Serve:** `npm run serve`

### Testing Strategy
- Manual testing across browsers
- Mobile device testing
- diff2html integration testing
- Git history edge cases
