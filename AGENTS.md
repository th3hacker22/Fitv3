# AGENTS.md

## CRITICAL: Read This First

**ALWAYS read `AI_OPERATING_SYSTEM.md` first.** It defines the entire product development workflow, the agent library, and the routing rules.

**No feature may be implemented until Discovery and PM have defined it.** Simplicity First. Technical Debt must be evaluated.

## Quick Reference

### Starting Work
1. Read `AI_OPERATING_SYSTEM.md`
2. Determine the mode: Proactive / Tiny Task / Large Feature
3. Follow the routing for that mode

### Agent Library
All agents are in `/skills/*.md`. Read the relevant agent before starting its phase.

### Non-Negotiable Rules
- **Simplicity First**: Existing screen → Setting → UX fix → New feature (in that order)
- **Tech Debt**: Evaluate maintenance cost, complexity cost, future risk for every feature
- **No `any` types**: Use `unknown` + type guards
- **No `ignoreBuildErrors`**: Fix errors, don't suppress them
- **Constitution**: Read `.specify/constitution.md` for the full rules

### Verification Gates (Every Change)
```bash
npx tsc --noEmit     # ≤ baseline errors
npx eslint .          # 0 new errors
npx vitest run        # 0 failures
```
