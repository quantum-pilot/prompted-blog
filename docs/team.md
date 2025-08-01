# Pair Programming Workflow

## Overview
This document outlines our pair programming workflow for building Prompted Blog. It ensures consistent process, proper testing, and knowledge capture as we work through the project plan.

## Story Workflow Process

This workflow ensures we maintain quality, capture knowledge, and make steady progress toward our MVP goal.

### 1. Story Selection & Planning
**Claude's Actions:**
- Identify the phase from `docs/plan.md` and pick up the next ⏳ **Pending** story from `docs/plan/phase-{number}.md` (e.g., phase-1.md)
- If all stories in current phase are complete, inform human and ask about next phase
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
- Add a comprehensive **Implementation Summary** section to the completed story in the phase document with:
  - What was implemented
  - Technical decisions made
  - Patterns established or followed
  - Bugs encountered and solutions
  - Lessons learned
  - Files created/modified
  - Any architectural changes
- **Prompt human to run Documentation Agent**: "Story X.Y is complete. I've added a detailed Implementation Summary to the story in the phase document. Please run the Documentation Agent to extract this information and update the permanent documentation."

## Documentation Updates

The Documentation Agent handles all documentation maintenance tasks including updates, deduplication, and consistency checks. Request human to run this agent after story completion.

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

## One-Off Bug Fix Process

When bugs are discovered outside of planned stories (e.g., mobile UI issues, responsiveness problems), follow this streamlined process:

### 1. Bug Identification & Planning
**Claude's Actions:**
- Clearly identify the bug and its impact
- Create a brief todo list for tracking the fix
- Propose solution approach to human for approval

### 2. Implementation & Testing
**Claude's Actions:**
- Implement the fix following project patterns
- Test the fix using browser tools (puppeteer MCP)
- Verify fix doesn't break existing functionality

### 3. Documentation
**Claude's Actions:**
- **In phase document:** Add bug fix using the standard format:
  ```
  ### BUG: [Brief Title]
  **Status:** ✅ **Completed**
  **Issue:** [Concise problem description]
  **What was built:**
  - [Bulleted list of key fixes]
  **Solution details in `docs/technicals/bug_fixes.md`**
  ```
- **In bug_fixes.md:** Add streamlined entry following the established format:
  - Root cause identification
  - Key insights for future reference  
  - File locations affected
  - Update quick reference section
- Request human to run Documentation Agent for broader doc updates

## Emergency Procedures

### If Issues Arise
- Break complex stories into smaller tasks and get approval
- Document architectural changes before implementing
- When stuck, propose alternatives and ask human for guidance

## Success Metrics
- Stories completed per session
- Build success rate (should be 100%)
- Quality of human verification feedback
- Documentation completeness
- Knowledge capture effectiveness
