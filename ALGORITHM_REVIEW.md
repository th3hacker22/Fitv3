# Algorithm Code Review — Pulse Fitness

**Date:** 2026-06-18
**Scope:** 11 files, algorithms/logic only
**Total findings:** 15 🔴 Critical + 22 🟠 Major + 18 🟡 Minor

**Status:** ✅ ALL 15 PRIORITY FIXES IMPLEMENTED + 8/8 SUGGESTED IMPROVEMENTS + 3 NEW FEATURES (2026-06-18)

---

## Implementation Status

| # | Issue | Status | File |
|---|-------|--------|------|
| 1 | Progressive overload ignores `lastE1RM` | ✅ Fixed | overloadEngine.ts (RPE-based, uses e1RM trend) |
| 2 | `assessFatigue` "+10%" branch unreachable | ✅ Fixed | fatigueEngine.ts (ACWR-based, recovery bonuses) |
| 3 | `shouldSuperset` ignores `intensityStyle: "supersets"` | ✅ Fixed | workoutGenerator.ts (respects user choice) |
| 4 | Antagonistic-pair matching uses wrong field | ✅ Fixed | workoutGenerator.ts (getMuscleIdsForExercise + movementPatterns) |
| 5 | Streak uses UTC date | ✅ Fixed | analytics.ts (localDateKey helper) |
| 6 | DST bug: `diffDays === 1` strict equality | ✅ Fixed | analytics.ts (calendarDaysBetween, Math.round) |
| 7 | `getWeekKey` collides across years | ✅ Fixed | analytics.ts (${year}-W${NN}) |
| 8 | `getTotalStats` counts incomplete sets | ✅ Fixed | analytics.ts (filter set.completed) |
| 9 | `daysSinceRest` penalty double-counts | ✅ Fixed | fatigueEngine.ts (graduated, no double-count) |
| 10 | `syncWorkoutVolume` no idempotency key | ✅ Fixed | challengesStore.ts (sessionId dedup Set) |
| 11 | `getLastExerciseData` full-scans DB | ✅ Fixed | useWorkoutStore.ts (30s TTL module cache) |
| 12 | 1RM cap at 12 reps under-estimates | ✅ Fixed | fitnessMath.ts (piecewise: Brzycki/Epley/Lombardi) |
| 13 | `getMuscleGroupStats` O(S×E) | ✅ Fixed | analytics.ts (Map<exerciseId, Exercise> index) |
| 14 | AI provider ZAI has no timeout | ✅ Fixed | aiProviders.ts (15s Promise.race + CircuitBreaker) |
| 15 | Fallback workout drops user's full profile | ✅ Fixed | aiWorkoutService.ts (throws → caller uses full profile + sessions) |

### Suggested Algorithm Improvements Status

| # | Improvement | Status | File |
|---|-------------|--------|------|
| 1 | ACWR-Based Fatigue Management | ✅ Implemented | fatigueEngine.ts |
| 2 | RPE-Based Progressive Overload | ✅ Implemented | overloadEngine.ts |
| 3 | Per-Muscle MEV/MAV Tracking | ✅ Implemented | overloadEngine.ts |
| 4 | Movement Pattern Balance | ✅ Implemented | movementPatterns.ts + workoutGenerator.ts |
| 5 | Exercise Novelty Scoring | ✅ Implemented | workoutGenerator.ts (scoreEx) |
| 6 | Fisher-Yates Shuffle | ✅ Implemented | workoutGenerator.ts |
| 7 | Search Index for Exercise Filtering | ✅ Implemented | exerciseService.ts (tokenized Map<token, Set<Exercise>>) |
| 8 | Circuit Breaker for AI Providers | ✅ Implemented | aiProviders.ts |

### New Features (beyond original review)

| Feature | Status | File |
|---------|--------|------|
| Learning Loop (track skips/swaps/completions for personalization) | ✅ Implemented | learningLoop.ts |
| Deload Week Auto-Scheduling (time/ACWR/performance triggers) | ✅ Implemented | deloadEngine.ts |
| Exercise Variation Rotation (rotate after 4 consecutive weeks) | ✅ Implemented | variationEngine.ts |

---

## Top 15 Priority Fixes

| # | Issue | Severity | File | Fix |
|---|-------|----------|------|-----|
| 1 | Progressive overload ignores `lastE1RM` — trend mis-classified | 🔴 | workoutGenerator.ts | Use `estimateOneRepMax(lastWeight, lastReps)` vs `history.lastE1RM` to derive trend |
| 2 | `assessFatigue` "+10%" branch unreachable (score never ≥4) | 🔴 | workoutGenerator.ts | Add positive deltas for low volume, adequate rest |
| 3 | `shouldSuperset` ignores explicit `intensityStyle: "supersets"` | 🔴 | workoutGenerator.ts | Add `force` parameter; don't short-circuit on session ≥45 when user chose supersets |
| 4 | Antagonistic-pair matching uses wrong field (`includes` on target) | 🔴 | workoutGenerator.ts | Route through `getMuscleIdsForExercise` and compare normalized muscle IDs |
| 5 | Streak uses UTC date, not local | 🔴 | analytics.ts | Use `localDate()` helper instead of `toISOString().split("T")[0]` |
| 6 | DST bug: `diffDays === 1` strict equality fails on DST days | 🔴 | analytics.ts | Compare calendar dates, not ms deltas; use `Math.round()` |
| 7 | `getWeekKey` collides across years (W1 of 2024 == W1 of 2025) | 🔴 | analytics.ts | Prefix with year: `${date.getFullYear()}-W${weekNum}` |
| 8 | `getTotalStats` counts incomplete sets in volume | 🔴 | analytics.ts | Add `s.completed` filter in volume calculation |
| 9 | `daysSinceRest` penalty double-counts (≥5 AND ≥7 both fire) | 🔴 | workoutGenerator.ts | Use `else if` or graduated formula |
| 10 | `syncWorkoutVolume` has no idempotency key (replay attack) | 🟠 | challengesStore | Include `sessionId` as dedup key |
| 11 | `getLastExerciseData` full-scans DB per exercise (6× per workout) | 🟠 | useWorkoutStore | Cache last-10 sessions in module scope |
| 12 | 1RM cap at 12 reps under-estimates high-rep sets by ~25% | 🟠 | fitnessMath.ts | Piecewise: Brzycki ≤10, Epley+Brzycki 11-12, Lombardi 13+ |
| 13 | `getMuscleGroupStats` O(S×E) — 2.4M comparisons for 500 sessions | 🟠 | analytics.ts | Build `Map<exerciseId, Exercise>` once |
| 14 | AI provider ZAI has no timeout (can hang 2+ minutes) | 🟠 | aiProviders.ts | Add `Promise.race` with 15s timeout |
| 15 | Fallback workout drops user's full profile (days, injuries, etc.) | 🟠 | aiWorkoutService.ts | Pass full `GeneratorProfile` to `generateProgram` |

---

## Suggested Algorithm Improvements

### 1. ACWR-Based Fatigue Management (replaces heuristic)
```
ACWR = 7-day rolling volume / 28-day rolling volume
- ACWR > 1.5 → high injury risk, deload recommended
- ACWR 0.8-1.3 → optimal zone
- ACWR < 0.8 → detraining risk, can increase volume
```
This is the gold standard in sports science (Gabbett 2016).

### 2. RPE-Based Progressive Overload
```
if all sets completed AND RPE ≤ 8 → increase weight (2.5kg upper, 5kg lower)
if all sets completed AND RPE 9 → keep weight, aim for +1 rep
if any set failed OR RPE 10 → deload 10%
```

### 3. Per-Muscle MEV/MAV Tracking
```
MEV (Minimum Effective Volume) = 10 sets/week per muscle
MAV (Maximum Adaptive Volume) = 20 sets/week per muscle
- If chest got 8 sets last week → below MEV, prioritize
- If back got 25 sets → above MAV, reduce
```

### 4. Movement Pattern Balance
```
Track: horizontal push/pull, vertical push/pull, knee flex/extend, hip hinge
Score exercises to balance patterns across the week
```

### 5. Exercise Novelty Scoring
```
Penalize exercises done in last 2 sessions (-10 score)
Bonus for exercises not done in 14+ days (+5 score)
```

### 6. Fisher-Yates Shuffle (replaces biased sort)
```ts
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

### 7. Search Index for Exercise Filtering
```
Build Map<token, Set<exerciseId>> on cache load
Tokenize: split name into words, lowercase, stem
Lookup: O(1) per token instead of O(N) scan
```

### 8. Circuit Breaker for AI Providers
```
Track failure count per provider
3 consecutive failures → 60s cooldown
Skip providers in cooldown
```
