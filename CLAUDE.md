# ROOT AGENT INSTRUCTIONS

**IMPORTANT: Root agent only. Specialist agents via Task tool should skip to specialist agent instructions at the bottom.**

## 1. Request Classification

### Handle Directly (No Specialists)
- Infrastructure: build scripts, configs, dependencies, tooling
- Project structure, CI/CD configuration

### Route to Specialists (Create Plan)
- Features, bugs, tests, refactoring
- Any task requiring domain expertise

### Request Clarification
Ask when:
- Multiple unrelated concerns mixed
- Critical acceptance criteria missing
- Ambiguous scope or requirements

## 2. Agent Routing

Map each task to the appropriate specialist agent:

- **styles agent**: CSS modules, visual styling, responsive design, Playwright visual tests
- **components agent**: Web Component creation/modification in src/components/, component logic and structure (≤100 lines)
- **foundation agent**: HTML pages, utility functions in src/utils/, API clients in src/api/, mock handlers in __mocks__/
- **frontend-debugger agent**: UI bug fixes, requires regression test with each fix, handles one bug at a time
- **cloudflare-backend agent**: Cloudflare Worker modules in workers/ directory, edge functions (≤100 lines)
- **security agent**: Vulnerability review, ALWAYS run as final step for all implementations

## 3. Example Plan Structure

```yaml
plan:
  - step: 1
    agent: components
    task:
      component: <kebab-case-tag>
      operation: create | modify | delete
      description: <what must change>
      acceptance:
        - <specific criteria>

  - step: 2
    agent: styles
    task:
      component: <kebab-case-tag>
      operation: create | modify
      description: <visual requirements>
      acceptance:
        - <visual criteria>

  - step: N
    agent: security
    task:
      review_type: story | bug
      components_modified: <components from previous steps>
      description: <implementation summary>
```

## 4. Execution Rules

1. **Serial execution only** - one step at a time
2. **Wait for completion** before next step
3. **Validation** - Run `npm run validate` after all steps
4. **Security mandatory** for all implementations

## 5. Failure Handling

Handle different failure types as follows:

- **Ambiguous request**: Immediately return `Error: <clarification needed>`
- **Agent failure**: Retry twice with adjusted task - escalate to human when it continuously fails
- **Security critical/high issues**: Create remediation plan with fixes, then re-review
- **Validation failure**: Create new remediation plan addressing validation errors

## 6. Quality Gates

- Exact agent input format matching (agent definitions available in `.claude/agents`)
- Logical step ordering (components → styles → security)
- Actionable acceptance criteria (no "nice", "fast")
- Deterministic plans (same input → same plan)

---

# SPECIALIST AGENT INSTRUCTIONS

**When invoked via Task tool:** Use your agent definition file in `.claude/agents/` for detailed instructions. Ignore all ROOT agent planning/routing instructions above.
