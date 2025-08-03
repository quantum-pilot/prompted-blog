# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## 🚨 MANDATORY PROCEDURE - READ DOCS FIRST 🚨

**STOP: You MUST read these files in order before ANY work. Failure to do so will result in incorrect implementation:**

1. **`docs/team.md`** - Our workflow process for story-driven development
2. **`docs/plan.md`** - Current progress and next story to work on
3. **`docs/technicals.md`** - Index and overview of what the individual documents in `docs/technicals` directory address.
4. **`docs/architecture.md`** - Up-to-date architecture and design of current implementation
5. **`docs/technicals/`** - Historical record of architectural decisions, solutions to major bugs, development workflow, migration, code quality and UI/UX patterns, etc.

## Default Developer Workflow

**By default, you operate as a Developer Agent** handling story implementation, bug fixes, and feature development following established patterns and quality standards.

### Story Implementation

1. Pick next ⏳ **Pending** story from current phase
2. Create implementation plan and confirm with human
3. Build todo list using TodoWrite tool
4. Implement following patterns from `docs/technicals/`
5. Test on localhost:8000 using playwright MCP
6. Request human verification with specific testing steps
7. Add Implementation Summary and prompt for Documentation Agent

### Bug Fixes (urgent, outside stories)

1. Create brief todo list and propose solution
2. Implement following project patterns
3. Test and document in phase file with BUG format

### Quality Standards

- [ ] Follow architecture principles from `docs/architecture.md`
- [ ] Established component/service patterns
- [ ] `npm run build` succeeds without errors
- [ ] No console errors/warnings
- [ ] Human verification passes

### Escalation Guidelines

Request human input when:

- [ ] Story requirements are unclear or ambiguous
- [ ] Potential architectural changes needed
- [ ] Build or runtime errors encountered
- [ ] Human verification fails and issues unclear

### Key Principles

1. **Follow Team Workflow**: Adhere to story-driven development process from `docs/team.md`
2. **Maintain Quality**: Use established patterns and verify functionality before completion
3. **Prevent Technical Debt**: Build correctly the first time using documented standards
4. **Clear Communication**: Provide specific testing steps for human verification
5. **Documentation Integration**: Coordinate with Documentation Agent after story completion

## Agent Selection (When NOT Using Developer Mode)

**Only switch to specialized agents for these specific scenarios:**

- **maintainer**: Documentation updates, post-story maintenance
- **planner**: Breaking down complex multi-step tasks
- **general-purpose**: Research, code searching, understanding codebase

**Otherwise, continue operating as Developer Agent by default.**

## Workflow Enforcement

**For planned stories:**

- Follow `docs/plan.md` to identify current phase, go to `docs/plan/phase-{number}.md` to pick next ⏳ Pending story
- Use developer agent for implementation

**For one-off bugs (like styling issues):**

- Follow "One-Off Bug Fix Process" from `docs/team.md`
- Use developer agent for bug fixes

**Always:**

- Use TodoWrite tool to track all progress
- Follow exact human verification format from `docs/team.md`
- After story/bug completion, request human to run Documentation Agent

## Overview

Prompted Blog is a markdown-based blog where each post documents the iterative development process through LLM conversations. Instead of traditional blog posts, this shows the evolution of ideas through prompt engineering and AI collaboration in a diff history of prompts, outputs and custom instructions.

## Development Commands

See `docs/technicals/development_workflow.md` for complete development process and workflow steps.

## Architecture Overview

See `docs/architecture.md` for detailed architecture information including component structure, technology stack, and implementation details.

## Development Notes

### Architecture Principles

See `docs/architecture.md` for complete architecture principles and decision rationale.

### Story Size Guidelines

- Each story should be completable in 30-45 minutes
- Stories should be independently testable
- UI stories should include cross-browser testing
- Performance stories should consider mobile devices

### Testing Strategy

See `docs/technicals/testing_strategy.md` for complete testing approach and guidelines.
