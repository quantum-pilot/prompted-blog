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
3. **Single sign-on**: Anyone with a Claude/OpenAI account should be able to start writing and publishing immediately.

## Frontend Design

### Component Structure

**TypeScript Web Components Architecture:**
- `<blog-header>` - Header with history toggle functionality
- `<post-viewer>` - Latest post rendering component  
- `<diff-viewer>` - Two-pane diff visualization (Prompts | Output)
- `<revision-scroller>` - Dot navigation for revision history
- `<instructions-modal>` - Floating instructions overlay

**Service Layer:**
- `ApiService` - Handles all HTTP requests and caching
- `UrlService` - Manages URL parameters and navigation state  
- `AppCoordinator` - Central coordinator connecting all components
- `DiffRenderer` - Shared service for rendering unified diff content across components

### Key Features Implemented

1. **Diff View History** - Diff view of revisions made to LLM prompts, instructions and output since origin.

## Development Phases

### Phase 1: Core Blog Engine ⏳ (4/5 stories completed)
- Basic blog structure ✅
- Diff history visualization ✅
- TypeScript and Web Components Migration ✅
- CSS Architecture and Organization ✅
- Multi-post navigation and architecture

## Technical Implementation

### Backend (`generate.py`)
- Walks git history to create `{rev}.diff` and `{rev}.txt` snapshots for each file
- Generates `revisions.json` with timestamps and `latest.json` with latest post date

### Frontend Flow
1. Fetch `latest.json`, then `revisions.json` for history mode
2. Load snapshots from `posts/{file}/{rev}.txt` (instructions from root)
3. Inject file content into diffs and render with diff2html
4. Instructions modal shows current revision with change indicator
5. Revision scroller navigates via URL `rev` parameter
