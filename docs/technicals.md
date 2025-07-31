# Technical Considerations & Decisions

## Overview
This contains technical decisions, lessons learned, and implementation notes for Prompted Blog. Each section focuses on a specific aspect of the project to keep information focused and accessible.

### [Development Workflow](./technicals/development_workflow.md)
Captures our build and testing strategy, story-driven development approach, and effective testing patterns. Includes details on:
- Build process with `pnpm build`
- Story-driven development methodology for 15-30 minute atomic stories
- Testing strategies for different types of features

### [Architecture Decisions](./technicals/architecture_decisions.md)
Major architectural decisions and their rationales. Key topics include:
- Backend architecture (diff generation and markdown rendering)
- Frontend web components and diff tool view
- Future considerations

### [UI/UX Patterns](./technicals/ui_ux_patterns.md)
Comprehensive guide to UI/UX patterns and component decisions. Covers:
- Diff view
- Enhanced navigation and accessibility features
- Responsive design

### [Bug Fixes](./technicals/bug_fixes.md)
Documentation of significant bugs and their fixes. Includes:
- Bugs that took a long time to solve
- Detailed root cause analysis and solution implementations

### [Frontend Migration](./technicals/frontend_migration.md)
Comprehensive documentation of migration from javascript to TypeScript and Web Components including:
- Critical decisions
- Choice of components
- Following ideas from https://plainvanillaweb.com
