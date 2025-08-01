# Prompted Blog - Architecture & Design Document

## Overview

Prompted Blog is a blog engine written through prompts to prompt LLMs to write blog posts and get it reviewed by humans.

## Target Users

Prompted Blog is designed for anyone who feels an LLM with personality can write better posts than them in order to get their ideas out in the world.

## Core Architecture

### Technology Stack

- **Frontend**: TypeScript with Web Components
- **Backend**: Any static server

### Architecture Decision Rationale

1. **Target Audience Alignment**: AI users already copy-paste from AI chats. This provides an interface for tracking their power user capabilities of enabling their writing.
2. **Simplified Architecture**: Following [Plain Vanilla Web](https://plainvanillaweb.com) principles to keep things simple and stupid

## Frontend Design

### Component Structure

The application uses TypeScript Web Components with a service-oriented architecture. Five main components handle the user interface:

- `<blog-header>` - Mobile-responsive header with navigation
- `<post-viewer>` - Post content rendering
- `<diff-viewer>` - Responsive diff visualization with mobile tabbed interface  
- `<revision-scroller>` - Dot navigation for revision history
- `<instructions-modal>` - Floating instructions overlay

The service layer provides shared functionality across components including API handling, URL management, component coordination, diff rendering, and error handling.

**For detailed component architecture and migration decisions, see:** `docs/technicals/frontend_migration.md`

### Key Features Implemented

1. **Responsive Diff View History** - Three-file diff view showing evolution of prompts, instructions, and outputs:
   - **Mobile (≤768px):** Tabbed interface with Prompts, Output, and Instructions tabs
   - **Desktop (≥769px):** Side-by-side layout: Prompts (left) | Output (right) with Instructions overlay
   - Touch-friendly revision navigation with mobile-optimized dot scroller
   - Auto-scroll to first change with visual change indicators
   - Uses diff2html for professional rendering with mobile space optimization

2. **Multi-post Navigation** - Hash-based routing (#/posts/YYYY-MM-DD/) with responsive prev/next buttons for browsing posts.

3. **Mobile-First Responsive Design** - CSS-only responsive design with established breakpoints:
   - Mobile: 320px-768px with tabbed interface and touch-friendly interactions
   - Tablet: 769px-1024px with hybrid layout optimizations
   - Desktop: ≥1025px with full side-by-side experience

## Development Status

**Phase 1 (Core Blog Engine):** Complete - All core functionality implemented and verified
**Phase 2 (UI/UX Enhancement):** In Progress - Mobile-responsive design system established

See `docs/plan.md` for detailed project phases and progress tracking.

## Technical Implementation

### Backend
- **generate.py** - Walks git history to create `{rev}.diff` and `{rev}.txt` snapshots for each file
- **render.sh** - Converts markdown to HTML, generates `latest.json` and `posts.json`
- **File Structure**: `posts/YYYY-MM-DD/` with `prompts.txt`, `output.md`, and `diff_cache/`

### Frontend Flow
1. Check URL hash for specific post (#/posts/YYYY-MM-DD/) or fetch `latest.json`
2. Navigate to specific post URL if at root
3. Load post content and update navigation button states
4. In history mode: fetch `revisions.json` and load snapshots
5. Inject file content into diffs and render with diff2html
6. Instructions modal shows current revision with change indicator
7. Revision scroller navigates via URL `rev` parameter
