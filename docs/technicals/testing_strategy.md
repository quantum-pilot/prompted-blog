# Testing Strategy for Prompted Blog

## Overview

This document outlines a minimal, focused testing strategy for Prompted Blog that addresses CSS/styling bugs and functionality issues without redundant test coverage. The approach prioritizes speed and maintainability while providing comprehensive coverage through two distinct testing layers.

## Testing Philosophy

### Core Principles
- **No Redundant Testing**: Each functionality tested only once, in the most appropriate layer
- **Clear Separation**: Unit tests for logic, visual tests for styling
- **Comprehensive Coverage**: All essential functionality covered, but without duplication
- **Speed Focus**: Fast development cycle with targeted test coverage
- **TDD Integration**: Write tests first to drive better design and catch issues early

### Two-Layer Testing Approach
1. **Unit Tests**: Component logic, data flow, API interactions, state management
2. **Visual Tests**: CSS rendering, responsive behavior, styling validation

## Testing Stack

### Tools
- **Vitest**: Unit tests for component logic and functionality
- **Playwright**: Visual tests for CSS rendering and responsive behavior
- **Git Hooks**: Automated test execution before code commits

### Coverage Strategy

#### Unit Tests (Vitest) - Logic Only
- Component state management and data flow
- API service calls and error handling
- URL routing and navigation logic
- Theme switching functionality
- Component coordination between services

#### Visual Tests (Playwright) - Styling Only  
- CSS rendering across breakpoints (mobile/tablet/desktop)
- Theme system visual validation
- Responsive layout behavior
- Component styling and positioning
- Cross-browser visual consistency

#### Manual Testing for Stories
- **UI Stories**: Manual verification across browsers and devices
- **Performance Stories**: Mobile performance testing
- **Integration Testing**: End-to-end workflows in localhost:8000

### No Overlap Rule
- **Logic tested once**: If unit test covers functionality, no visual test for same feature
- **Styling tested once**: If visual test covers CSS behavior, no unit test duplication
- **Clear boundaries**: Unit tests never assert on visual appearance, visual tests never assert on logic

## Test Coverage Areas

### Unit Test Focus (Logic Only)
- **Component Lifecycle**: Initialization, cleanup, event management
- **State Management**: Theme switching, navigation states, revision tracking
- **Service Coordination**: Component communication, API data flow
- **Error Handling**: Service failures, network issues, fallback behavior
- **URL Management**: Route parsing, navigation triggers, history state

### Visual Test Focus (Styling Only)
- **Responsive Breakpoints**: Mobile (320-768px), tablet (769-1024px), desktop (1025px+)
- **Theme System**: Light/dark mode visual consistency
- **Component Layout**: Header positioning, diff viewer modes, button arrangements
- **Interactive States**: Hover effects, focus indicators, active states
- **Cross-Browser**: Chrome, Firefox, Safari visual consistency

## Component Architecture Strategy

### CSS Integration Approach
- **Current Issue**: Separate CSS files create context switching and maintenance overhead
- **Recommended**: CSS Modules co-located with components for easier testing and maintenance
- **Benefit**: Direct relationship between component logic and styling

### Component Splitting Strategy

#### Component Size Guidelines
- **Target**: 20-80 lines per component for optimal testability
- **Current BlogHeader**: 158 lines (should be split)
- **Principle**: Single responsibility per component

#### Recommended Splits

**BlogHeader Refactoring**:
- ThemeToggle component (25-30 lines) - isolated theme logic
- NavigationButtons component (40-50 lines) - prev/next functionality  
- BlogHeader component (50-60 lines) - header content and coordination

**DiffViewer Refactoring**:
- TabNavigation component - mobile tab switching
- DiffContent component - diff rendering without navigation

### File Organization
- Component folders with co-located CSS modules and tests
- Clear separation between unit tests (logic) and visual tests (styling)
- Test files adjacent to components for easy maintenance

## Proposed File Structure

### Current Structure Issues
```
src/components/blog-header.ts
assets/css/components/blog-header.css
```
- Separated files create context switching
- Hard to maintain CSS-component relationships
- Testing requires navigating between distant files

### Recommended Structure
```
src/
├── components/
│   └── {component-name}/
│       ├── index.ts                    # Component implementation
│       ├── {component-name}.module.css # Co-located styling
│       └── __tests__/
│           ├── {component-name}.test.ts     # Unit tests (logic only)
│           └── {component-name}.visual.ts   # Visual tests (styling only)
├── services/
│   ├── {service-name}.ts
│   └── __tests__/
│       └── {service-name}.test.ts      # Service logic tests
└── __tests__/
    └── integration/
        └── {workflow-name}.test.ts     # Cross-component integration tests
```

### Benefits of Co-located Structure
- **Single Context**: Component logic, styling, and tests in one folder
- **Easy Navigation**: All related files adjacent to each other
- **Better Testing**: Direct relationship between component and its tests
- **Reduced Cognitive Load**: No need to remember separate CSS file locations
- **Import Clarity**: `import styles from './component.module.css'`

## Development Workflow

### TDD Process
1. **Red Phase**: Write failing test for expected behavior
2. **Green Phase**: Implement minimal code to pass test
3. **Refactor Phase**: Improve code while maintaining test coverage

### Bug Fix Workflow
- Write test that reproduces the bug
- Fix implementation to pass the test
- Ensure test remains in suite for regression prevention

### Story Completion Requirements
- TDD cycle completed (Red → Green → Refactor)
- Unit tests pass for logic changes
- Visual tests pass for styling changes
- Git hook validation passes before commit

## Success Metrics

### Quality Goals
- Significant reduction in CSS/styling bugs through visual testing
- Faster debugging with targeted test failures
- Increased confidence in refactoring and changes

### Efficiency Targets
- Minimal test maintenance overhead (<20% of development time)
- Fast test execution for immediate feedback
- Clear test boundaries to avoid redundant coverage

### LLM Collaboration
- Test files small enough for context window efficiency
- Clear, focused test scope for easy understanding
- Minimal boilerplate for quick comprehension

This minimal testing strategy balances comprehensive coverage with development speed, focusing on essential functionality while avoiding redundant test layers.