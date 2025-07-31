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

### Key Features Implemented

1. **Diff View History** - Diff view of revisions made to LLM prompts, instructions and output since origin.

## Development Phases

### Phase 1: Core Blog Engine ⏳ (3/5 stories completed)
- Basic blog structure ✅
- Diff history visualization ✅
- TypeScript and Web Components Migration ✅
- CSS Architecture and Organization
- Multi-post navigation and architecture

## Technical Implementation Details

### Diff Generation (`generate.py`)

For every post and global custom instruction:
1. Fetch commit history of the files
2. Generate diff from the previous version at `{num}.diff`
3. Generate snapshot of file at a given version at `{num}.txt`
4. Aggregate `revisions.json` containing revisions with timestamps
5. Update `latest.json` with latest post date

### UI Diff View (TypeScript Components)

1. Fetch `latest.json`
2. If history is enabled:
    1. Fetch `revisions.json` for each file, merge and sort them by their timestamps
    2. Most revision number is set in URL query parameter `rev`. If none is set, then use latest.
    2. Find the associated snapshot for `prompts.txt` under `prompts.txt/{rev}.txt`, `output.md` under `output.md/{rev}.txt` inside `posts`. Do the same for `.diff` files for each target. Since `instructions.txt` is global, its snapshot and diff can be found at root.
    3. Find the line numbers of diff headers in each `{rev}.diff`, prepend or append file content obtained from the snapshot `{rev}.txt` as necessary.
    4. Render the entire diff in inline view with injected file contents using `diff2html` library.
    5. First version must be shown entirely as additions since it will not have a diff.
    6. Set the scroller to `rev` page.
    7. `Instructions` button next to `Prompts` will toggle a modal for current instructions.
        1. If instructions changed for that revision, the button will show `Changed` and appear as yellow.
        2. Else: it will stay gray
        3. Clicking close button will close the modal.
3. Else: fetch `index.html` for that post and display directly
