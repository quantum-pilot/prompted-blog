
## Development Workflow

### Local Development
1. Make content changes and commit to git
2. Run `python engine/generate.py` and `./engine/render.sh` 
3. Build TypeScript: `npm run build`
4. Serve with `npm run serve`

### TypeScript Development
- Dev mode: `npm run dev`
- Build: `npm run build` 
- Serve: `npm run serve`

See [frontend_migration.md](./frontend_migration.md) for TypeScript migration details.

### Testing
Manual testing across browsers and mobile devices, focusing on diff2html integration and git history edge cases.

### Documentation Maintenance
**Regular Deduplication**: Documentation tends to accumulate redundancy over time as implementation details get duplicated across plan, architecture, and technical docs. Periodic compaction maintains focus:
- Plans should contain acceptance criteria, not implementation details
- Architecture docs should reference technicals/ for detailed patterns
- Each document should serve a distinct purpose and audience
