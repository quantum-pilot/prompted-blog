
## Development Workflow

### Local Development
1. Make content changes and commit to git
2. Run `python engine/generate.py` and `./engine/render.sh` (generates posts.json automatically)
3. Build TypeScript: `npm run build`
4. Assume that user will always run the development server 

### TypeScript Development
- Build: `npm run build` 

See [frontend_migration.md](./frontend_migration.md) for TypeScript migration details.

### Testing
Manual testing across browsers and mobile devices, focusing on diff2html integration and git history edge cases.

### Documentation Maintenance
Documentation maintenance is handled by the Documentation Agent. This agent should be run:
- After each story completion
- During periodic documentation reviews
- When inconsistencies are suspected

The agent handles deduplication, consistency checks, and maintains documentation quality across the project.
