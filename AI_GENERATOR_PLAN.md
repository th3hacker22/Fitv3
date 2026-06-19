# AI Workout Generator — Improvement Plan

**Generated using:** web-search (best practices research) + VLM (current UI analysis) + LLM (plan generation)

---

## Executive Summary

The current AI Generator has **14 steps** — too many for onboarding (industry best practice: 5-7). The age input uses a slider (imprecise on mobile). The algorithm is deterministic but lacks progressive overload tracking and fatigue management.

**Goal:** Reduce to 5 steps, implement smart defaults, add progressive overload, and replace the age slider with a stepper.

---

## 1. Algorithm Improvements

### Progressive Overload
- Track user's performance history (weight, reps, sets)
- Auto-increase difficulty when user exceeds targets by 15% over 3 sessions
- Separate progression models: beginner (linear), intermediate (weekly undulating), advanced (block periodization)

### Fatigue Management
- Calculate accumulated fatigue score from recent training volume + intensity
- Auto-trigger deload weeks when fatigue exceeds threshold
- Reduce volume 20-40% during high-stress periods

### Exercise Pairing
- Antagonistic pairing (push/pull) by default
- Auto-create supersets when session < 45 minutes
- Group exercises by equipment to minimize transitions

### Learning Loop
- Track which exercises users skip/modify → refine future recommendations
- Use completion rates to identify problematic workouts
- Reinforcement learning for long-term personalization

---

## 2. Design Improvements

### Streamlined Flow: 14 Steps → 5 Steps

| New Step | Merged From | Fields |
|----------|------------|--------|
| **1. Goal & Experience** | Goal + Experience + Physique Focus | Primary Goal, Experience Level, Physique Focus (optional) |
| **2. Availability & Equipment** | Frequency + Duration + Environment | Days/week (stepper), Duration (stepper), Equipment (multi-select) |
| **3. Muscles & Preferences** | Key Muscles + Preferences | Muscle focus (body map), Workout style, Include cardio/core |
| **4. Health & Safety** | Health/Safety (simplified) | Injuries (multi-select), Limitations (text), Medical clearance |
| **5. Review & Generate** | Review (simplified) | Summary cards + sample workout + Generate button |

### Card-Based Layout
- Expandable cards with only essential fields visible initially
- Visual progress bar (not numbered steps)
- Contextual "?" help icons
- Smart defaults pre-filled from profile/previous selections

### Visual Feedback
- Real-time preview: estimated workout time + volume as user selects
- Exercise thumbnails with muscle group highlights
- Intensity indicator (light/moderate/vigorous)
- Confidence score (high/medium/low) based on data completeness

---

## 3. UX Improvements

### Age Input: Stepper (NOT Slider)

**Current:** Slider (imprecise, hard to select specific age on mobile)

**New Design:**
```
        ┌─────────┐
        │    25    │
        │  years   │
        └─────────┘
     [-5]      [+5]
     
     [ Type age directly: ___ ]
     
     💡 Age helps us recommend 
     appropriate intensity and recovery
```

- Default to profile age or 30
- ±5 year buttons for quick adjustment
- Direct text input for precision
- Contextual help message
- Age range validation (13-100)

**Why not slider?** Too imprecise, poor mobile UX, hard to hit exact age
**Why not wheel picker?** Takes too much screen space, confusing for some users

### Age-Based Algorithm Adjustments
| Age Range | Adjustments |
|-----------|-------------|
| 18-25 | Higher volume tolerance, faster recovery |
| 26-40 | Balanced approach, moderate volume |
| 41-55 | Increased warm-up, controlled progression |
| 55+ | Lower impact, increased recovery, modified exercises |

### Smart Defaults
- Pre-fill from profile when available
- Goal-based defaults (e.g., strength → 4 days/week, barbell)
- Skip optional steps with "Skip for now" button
- Only show advanced options when user taps "Customize"

---

## 4. Step Redesign Details

### Step 1: Goal & Experience (merged 3 → 1)
- Primary Goal: single choice (Build Muscle, Lose Fat, Strength, Endurance, General)
- Experience: Beginner / Intermediate / Advanced
- Physique Focus: optional (Balanced, Upper, Lower, Core)
- Auto-fill experience from performance history if available

### Step 2: Availability & Equipment (merged 3 → 1)
- Days/week: visual stepper with day icons (1-7)
- Duration: stepper in 15-min increments (15-90 min)
- Equipment: multi-select chips (Bodyweight, Dumbbells, Barbell, Machines, Bands)
- Smart defaults based on goal + experience

### Step 3: Muscles & Preferences (merged 2 → 1)
- Interactive body map for muscle selection
- Workout style: Traditional / Supersets / Circuits / HIIT
- Include cardio/core finisher toggles
- Only shown if user wants to customize (otherwise skip)

### Step 4: Health & Safety (simplified)
- Injuries: multi-select with body map
- Limitations: free text
- Medical clearance: checkbox
- Age-based injury warnings for 40+

### Step 5: Review & Generate (simplified)
- Visual summary cards for each selection
- 2-3 sample exercises shown
- "Adjust" button on each card
- Large "Generate Workout" CTA
- Estimated time + volume displayed

---

## 5. Implementation Priority

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Reduce 14 steps → 5 (merge steps in GeneratorWizard) | 4h |
| P0 | Replace age slider with stepper component | 1h |
| P1 | Add smart defaults (goal-based pre-fills) | 2h |
| P1 | Real-time workout preview (time + volume) | 3h |
| P2 | Progressive overload tracking in workoutGenerator.ts | 6h |
| P2 | Fatigue management system | 8h |
| P3 | Exercise pairing optimization (supersets) | 4h |
| P3 | Learning loop (track skips/modifications) | 6h |

**Total: ~34 hours (1-2 weeks)**

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Wizard completion rate | ~60% | 85%+ |
| Time to generate | ~3:45 | < 2:00 |
| Step count | 14 | 5 |
| Age input precision | Slider (±3) | Stepper (exact) |
| User satisfaction (NPS) | — | +15 points |
| Workout completion | — | +10% |
