# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Quick Start for New Sessions

**Before starting any work, read these files in order:**

1. **`docs/team.md`** - Our workflow process for story-driven development
2. **`docs/plan.md`** - Current progress and next story to work on
4. **`docs/architecture.md`** - Up-to-date architecture and design of current implementation
3. **`docs/technicals.md`** - Index and overview of what the individual documents in `docs/technicals` directory address.
5. **`docs/technicals/`** - Historical record of architectural decisions, solutions to major bugs, development workflow, migration, UI/UX patterns, etc.

**Key workflow reminders:**
- Follow `docs/plan.md` to identify current phase, go to `docs/plan/{phase}.md` to pick a story and update the plan as necessary.
- Always use the TodoWrite tool to track story progress
- Follow the exact human verification format from `docs/team.md`
- Update `docs/architecture.md` on changes to current architecture after each story.
- Follow `docs/technicals.md` to see how individual documents need to be updated inside `docs/technicals/` directory. Existing list of documents cover majority of scenarios, but create documents if necessary.

## Overview

Prompted Blog is a markdown-based blog where each post documents the iterative development process through LLM conversations. Instead of traditional blog posts, this shows the evolution of ideas through prompt engineering and AI collaboration in a diff history of prompts, outputs and custom instructions.

## Development Commands

This is the current development process. It is subjected to change as the project evolves.

### Current (Phase 1.1-1.2)
- `python engine/generate.py` - Generates artifacts to be used by static server
- `./engine/render.sh` - Generates rendered markdown in HTML using a docker container
- `python -m http.server` - Runs a simple static server at root

### After TypeScript Migration (Phase 1.3+)
- `npm run build` or `pnpm build` - Compiles TypeScript and prepares assets
- `npm run dev` or `pnpm dev` - Development server with hot reload
- `python engine/generate.py` - Generates artifacts to be used by static server
- `./engine/render.sh` - Generates rendered markdown in HTML using a docker container

## Architecture Overview

### Frontend (index.html + assets/main.js):
  - Vanilla JS with imported assets like `diff2html.min.js`, `github-markdown.css`, etc.
  - Clean, GitHub-style markdown renderer for normal blog view
  - History mode showing side-by-side diffs of three key files
  - Revision scroller with dots to navigate through different iterations

### Backend (engine/):
  - generate.py - Walks git history to create diff cache as JSON
  - render.sh - Converts markdown to HTML using GitHub-flavored styling
  - Generated artifacts will be deployed to object storage

## Development Notes

### Architecture Principles
- Keep it simple and stupid - no complex frameworks other than TypeScript and web components
- Git-driven content generation
- Static file serving for performance
- Mobile-first responsive design
- Accessibility from the start

### Story Size Guidelines
- Each story should be completable in 30-45 minutes
- Stories should be independently testable
- UI stories should include cross-browser testing
- Performance stories should consider mobile devices

### Testing Strategy
- **UI Stories**: Manual verification across browsers and devices
- **Performance Stories**: Mobile performance testing
