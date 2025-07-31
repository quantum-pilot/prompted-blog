# Pair Programming Workflow

## Overview
This document outlines our pair programming workflow for building Prompted Blog. It ensures consistent process, proper testing, and knowledge capture as we work through the project plan.

## Story Workflow Process

This workflow ensures we maintain quality, capture knowledge, and make steady progress toward our MVP goal.

### 1. Story Selection & Planning
**Claude's Actions:**
- Identify the phase from `docs/plan.md` and pick up the next ⏳ **Pending** story from `docs/plan/{phase}.md`
- Review the story's acceptance criteria and testing requirements
- If the story is ambiguous or needs input, prompt the human for clarification.
- Create a brief implementation plan (2-3 bullet points)
- **Confirm plan with human before proceeding**

### 2. Implementation Preparation
**Claude's Actions:**
- After brief plan is approved by human, create a comprehensive implementation plan
- Build a detailed todo list for the story implementation using TodoWrite tool
- Review `CLAUDE.md` for project-specific commands and architecture notes
- Update todo list to mark story as "In Progress"
- Read any relevant existing files to understand current state

### 3. Implementation
**Claude's Actions:**
- Implement the story following acceptance criteria
- Write clean, well-structured code following established patterns
- Use proper error handling where needed

### 4. Testing & Verification
**Claude's Actions:**
- Use puppeteer MCP server for running browser - navigate to localhost:8000 for verifying the implementation
- Never run static server - human manages the python server

### 5. Human Verification Request
**Claude's Actions:**
- Summarize what was implemented
- List what should be visible/testable in the app
- **Provide specific testing steps for the human**
- **Prompt human to verify in running app**

**Required format:**
> "## Story X.Y Implementation Complete!
>
> **Changes made:**
> - [Bulleted list of key changes]
>
> **Please verify in the app:**
> - [Specific steps to test the functionality]
> - [Expected behavior/output]
>
> **Expected results:**
> - [What should happen if working correctly]
> - [Any specific UI changes to look for]
>
> **Ready for your verification!**"

### 6. Human Testing & Feedback
**Human's Actions:**
- Test the changes in the running app
- Verify acceptance criteria are met
- Provide feedback: "Perfect! That worked!" or describe issues

**If Issues Found:**
- Human describes what went wrong or what's not working
- Claude investigates and fixes the issues
- Return to step 4 (Testing & Verification) after fixes
- Repeat until verification succeeds

### 7. Story Completion
**Claude's Actions (after human confirms success):**
- Update todo list to completed
- **Follow complete post-story documentation checklist** (see Story Completion Documentation Workflow below)
- Verify no content duplication across documentation

## Documentation Updates

### During Each Story
**Claude should update these files as needed:**

#### `CLAUDE.md` Updates
- Add new commands or update existing if it has diverged
- Update architecture notes if patterns change
- Document any new dependencies or tools
- Note any gotchas or important considerations

#### `docs/technicals` Updates
- Document technical decisions and rationale
- Record issues encountered and solutions
- Note what works well and what to avoid
- Capture performance considerations
- Document testing strategies that work

## Quality Checks

### Before Marking Story Complete
- [ ] All acceptance criteria met
- [ ] All specified tests pass
- [ ] No new console errors or warnings
- [ ] Code follows project conventions
- [ ] Relevant documentation updated
- [ ] Human verification completed

### Code Quality Standards
- Use TypeScript types properly
- Handle errors gracefully
- Write clear, self-documenting code
- Keep functions small and focused

## Communication Patterns

### Starting a Story
Claude: "Ready for Story X.Y: [Title]. My plan: [brief plan]. Does this approach sound good?"

### During Implementation
Claude: [Work silently through implementation, testing, and verification]

### Requesting Verification
Claude: "Story X.Y implementation complete! Changes: [summary]. Please verify: [specific things to check]. Ready for your verification!"

### After Human Confirmation
Claude: "Great! Marking Story X.Y as completed. Moving to next story..."

## Emergency Procedures

### If Story Becomes Too Complex
- Break it down into smaller sub-tasks
- Document the breakdown in the relevant document in `docs/technicals`
- Get human approval for the new approach

### If Architecture Changes Needed
- Document the change rationale in `docs/technicals`
- Update `docs/architecture.md` and `docs/architecture_decisions.md` as needed
- Get human approval before major changes

### If Stuck on Technical Issue
- Document the issue in `docs/technicals`
- Propose 2-3 alternative approaches
- Ask human for guidance

## Success Metrics
- Stories completed per session
- Build success rate (should be 100%)
- Quality of human verification feedback
- Documentation completeness
- Knowledge capture effectiveness

## Story Completion Documentation Workflow

**This comprehensive checklist must be followed after every story completion:**

### 1. Update Progress Tracking
- [ ] Mark story as ✅ **Completed** in `docs/plan/phase-{N}.md`
- [ ] Update progress counters in `docs/plan.md` 
- [ ] Update next priority in `docs/plan.md`

### 2. Update Current Architecture (if architecture changed)
- [ ] Update technology stack in `docs/architecture.md`
- [ ] Update component structure if changed
- [ ] Update development phase progress  
- [ ] Update technical implementation details if changed

### 3. Document Technical Decisions (if significant decisions made)
- [ ] Create or update relevant file in `docs/technicals/` directory
- [ ] Follow `docs/technicals.md` index to determine which file needs updates
- [ ] For major changes (migrations, new patterns), create dedicated document
- [ ] Update `docs/technicals.md` index if new document created

### 4. Update Development Workflow (if build/commands changed)
- [ ] Update `CLAUDE.md` development commands if build process changed
- [ ] Update `docs/technicals/development_workflow.md` if workflow changed  
- [ ] Reference detailed technical docs instead of duplicating content

### 5. Verify Documentation Consistency
- [ ] **Check for content duplication** across all documentation files
- [ ] **Ensure cross-references work** and point to correct locations
- [ ] **Verify single source of truth** for complex topics (no duplicate explanations)
- [ ] Update reading order in `CLAUDE.md` if document structure changed

### 6. Quality Check Documentation Structure
- [ ] Run comprehensive analysis of all docs/ files if major documentation changes made
- [ ] Remove duplicate content and replace with proper references
- [ ] Ensure each document has focused, distinct purpose

**Example:** Story 1.3 (TypeScript Migration) required:
- Progress tracking updates ✅
- Architecture updates (technology stack, component structure) ✅  
- New technical document (`frontend_migration.md`) ✅
- Development workflow updates (npm commands) ✅
- **Documentation deduplication analysis and cleanup** ✅

**Critical:** Steps 5-6 are essential for maintaining clean, maintainable documentation as the project grows. Always verify no duplication exists after significant changes.
