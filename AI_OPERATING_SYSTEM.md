# AI Operating System

> **CRITICAL: ALWAYS read this file first.** No feature may be implemented until Discovery and PM have defined it. Simplicity First. Technical Debt must be evaluated.

## Philosophy
"We build products, not just features." Every feature must:
1. Start with a **user problem** (not a feature idea)
2. End with a **measurable metric** (not a vibe)
3. Pass the **Simplicity Check** (can it be a setting/screen fix instead?)
4. Have **Tech Debt evaluated** (maintenance cost vs expected value)

## The Agent Library

All agents live in `/skills/`. Each is a `.md` file defining a role, when it's invoked, its process, and its output format.

### Core Strategy & Flow
| Agent | Role | When |
|-------|------|------|
| `product-strategist` | Proposes 3 features with Problem/Metric/Hypothesis | Proactive mode (monthly or on-demand) |
| `discovery-analyst` | Validates the problem is real + affects enough users | After strategist proposes, or stakeholder requests |
| `product-manager` | Defines Problem/Metric/Hypothesis/Success Criteria — REJECTS if any missing | After discovery says PROCEED |
| `ux-auditor` | Audits usability (friction, consistency, empty states, a11y) | After council approves |
| `architecture-reviewer` | Audits tech (data, API, state, security, perf, constitution) | After council approves |
| `qa-tester` | Tests after implementation (unit, integration, E2E, regression, browser) | After implementation |

### Product Specialists
| Agent | Role | When |
|-------|------|------|
| `gym-beginner` | Persona: never lifted, intimidated, needs guidance | During strategist + council |
| `advanced-athlete` | Persona: 5+ years, wants data depth + control | During strategist + council |
| `habit-psychologist` | Evaluates Hooked Model (Trigger/Action/Reward/Investment) | During strategist + council (veto power) |
| `competitor-analyst` | How do Hevy/Lyfta/Strong/Fitbod do this? What's our wedge? | During strategist + council |
| `retention-engineer` | Does this increase D1/D7/D30 return? (veto power) | During council |
| `product-council` | Final decision: BUILD / POSTPONE / REJECT (5 gates) | After PM defines spec |

### Technical & Post-Launch
| Agent | Role | When |
|-------|------|------|
| `security-auditor` | Auth, validation, data exposure, rate limiting | After council approves |
| `performance-reviewer` | Bundle, render, data layer, API, memory, mobile | After council approves |
| `accessibility-reviewer` | WCAG 2.1 AA, keyboard, screen reader, motion | After council approves |
| `metrics-reviewer` | Did it hit the KPI? Keep/Iterate/Kill | 7-14 days post-release |

---

## Routing: Three Modes

### Mode 1: Proactive (Monthly / On-Demand)

**Trigger**: "What should we build next?"

```
product-strategist
  → (analyzes codebase + competitors + psychology)
  → 3 feature proposals (each with Problem, Metric, Hypothesis)

competitor-analyst
  → (for each proposal: how do competitors do it? what's our wedge?)

habit-psychologist
  → (for each proposal: does this build a habit? Hook strength?)

→ Output: 3 ranked proposals with competitive + habit analysis
→ Human (PD) picks 0-3 to enter the Large Feature pipeline
```

### Mode 2: Tiny Task (Quick Fix)

**Trigger**: "Fix this bug" / "Improve this copy" / "Adjust this styling"

```
frontend-expert (or relevant specialist)
  → implements the fix

qa-tester
  → verifies: tsc + lint + vitest + Agent Browser
  → SHIP or FIX
```

**Rules**:
- No Discovery/PM needed (it's a fix, not a feature).
- Must still pass tsc + lint + tests.
- If the "fix" turns out to be a feature in disguise → escalate to Large Feature.

### Mode 3: Large Feature (New Functionality)

**Trigger**: A proposal from Proactive Mode OR a stakeholder request.

```
discovery-analyst
  → validates the problem (evidence, affected users, severity)
  → checks Simplicity (existing screen? setting? UX fix?)
  → REJECT if simpler alternative exists
  → REJECT if <5% affected + nice-to-have

product-manager
  → defines Problem / Metric / Hypothesis / Success Criteria
  → REJECT if any of the 4 is missing
  → defines scope, MVP, tech debt estimate

product-council
  → 5-gate review: Simplicity / Problem / Retention / Tech Debt / Wedge
  → BUILD / POSTPONE / REJECT

IF BUILD:
  ux-auditor + architecture-reviewer + security-auditor + performance-reviewer + accessibility-reviewer
    → (parallel review)
    → each outputs PASS/FAIL with conditions

  Implementation (developer)
    → implements per spec + audit conditions
    → no `any`, no `ignoreBuildErrors`, constitution-compliant

  qa-tester
    → unit + integration + E2E + regression + Agent Browser
    → SHIP or FIX

  metrics-reviewer (7-14 days post-release)
    → did it hit the KPI?
    → KEEP / ITERATE / KILL
```

---

## The 5 Gates (Product Council)

Every Large Feature must pass ALL 5:

1. **Simplicity Gate**: Can this be solved with an existing screen, a setting, or a UX improvement? → If YES, REJECT.
2. **Problem Gate**: Evidence this solves a real problem affecting ≥5% of users? → If NO, REJECT.
3. **Retention Gate**: Strengthens the core loop or increases returning value? → If NEGATIVE, REJECT.
4. **Tech Debt Gate**: Maintenance cost justified by expected value? → If High maintenance + ≤Medium value, REJECT.
5. **Wedge Gate**: Strengthens our unique advantage (ACWR/offline/RPE/MEV-MAV/deload)? → If DILUTES, REJECT.

One REJECT = feature is REJECTED. No overrides.

---

## Simplicity First (Non-Negotiable)

Before ANY feature proposal:
1. Can this be solved with an **existing screen**? → Use it.
2. Can this be solved with a **setting** (toggle in Settings)? → Add the setting.
3. Can this be solved by **improving UX** (better copy, clearer icon, simpler flow)? → Improve the UX.
4. Only if ALL THREE are "No" → propose a new feature.

Prefer removing complexity over adding features.

## Technical Debt (Non-Negotiable)

For every feature, estimate:
- **Maintenance cost**: How much ongoing work to keep this alive? (Low/Med/High)
- **Complexity cost**: How much code/test/infra does this add? (Low/Med/High)
- **Future risk**: What could this break or block? (1 sentence)

A feature may be REJECTED if maintenance cost exceeds expected value.

---

## Our Wedge (Protect This)

Pulse Fitness differentiates on 5 things. Every feature should strengthen at least one, and never dilute any:

1. **ACWR Fatigue Science** (Gabbett 2016) — nobody else uses Acute:Chronic Workload Ratio
2. **Offline-First** (Dexie/IndexedDB is source of truth) — no internet needed to log
3. **RPE-Based Progression** (Helms 2018) — track RPE per set, use for progression
4. **MEV/MAV Per Muscle** (Schoenfeld 2017) — minimum effective / maximum recoverable volume
5. **Deload Auto-Detection** — 3 triggers (time, ACWR, performance regression)

If a feature doesn't strengthen ANY of these, it must be table-stakes (something competitors all have). If it's not table-stakes either, REJECT.
