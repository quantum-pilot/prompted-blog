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

**TypeScript Web Components Architecture:**
- `<blog-header>` - Header with history toggle and prev/next navigation buttons
- `<post-viewer>` - Post rendering component with dynamic loading  
- `<diff-viewer>` - Two-pane diff visualization (Prompts | Output)
- `<revision-scroller>` - Dot navigation for revision history
- `<instructions-modal>` - Floating instructions overlay

**Service Layer:**
- `ApiService` - Handles all HTTP requests, caching, post list and navigation
- `UrlService` - Manages URL parameters, hash routing and navigation state  
- `AppCoordinator` - Central coordinator connecting all components and handling routing
- `DiffRenderer` - Shared service for rendering unified diff content across components

### Key Features Implemented

1. **Diff View History** - Three-file diff view showing evolution of prompts, instructions, and outputs:
   - Side-by-side layout: Prompts (left) | Output (right) with Instructions overlay
   - Revision navigation with dot scroller
   - Auto-scroll to first change
   - Uses diff2html for professional rendering

2. **Multi-post Navigation** - Hash-based routing (#/posts/YYYY-MM-DD/) with prev/next buttons for browsing posts.

## Development Status

Phase 1 (Core Blog Engine) is complete. See `docs/plan.md` for project phases and future considerations.

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
