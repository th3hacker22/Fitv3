# Pulse Fitness — Current UI Inventory

> Audited via direct source-code reading + live Agent-Browser a11y snapshots of `http://localhost:3000/`.
> Captured: Home, AI Generator (all 5 steps), Stats, Profile, Settings, Layout/Nav.
> Source files: `src/pages/*.tsx`, `src/components/workout/GeneratorWizard.tsx`, `src/components/AnatomyMap.tsx`, `src/app/globals.css`.

---

## Design System ("Pulse Neon")

### Colors — `src/app/globals.css`

**Dark mode (default identity — lime neon):**
| Token | Value | Usage |
|---|---|---|
| `--c-bg` | `#050505` | App background |
| `--c-bg-surface` | `#0f0f11` | Cards |
| `--c-bg-elevated` | `#141416` | Inputs, hover |
| `--c-primary` | `#ccff00` (lime) | CTAs, accents |
| `--c-secondary` | `#00f0ff` (cyan) | Secondary accents |
| `--c-success` | `#00e676` | Positive states |
| `--c-warning` | `#ffab00` | Streaks, cautions |
| `--c-danger` | `#ff5252` | Destructive |
| `--c-info` | `#38bdf8` | Info badges |
| `--c-text-primary` | `#ffffff` | Headings |
| `--c-text-secondary` | `#9ca3af` | Body muted |
| `--c-text-muted` | `#828e9f` | Captions |
| `--c-border` | `rgba(255,255,255,0.06)` | Hairline borders |
| `--glass-bg` | `rgba(255,255,255,0.03)` | Glass cards |

**Light mode (high-contrast emerald — WCAG AAA):**
| Token | Value | Contrast on white |
|---|---|---|
| `--c-bg` | `#f1f5f9` | — |
| `--c-bg-surface` | `#ffffff` | — |
| `--c-primary` | `#047857` (deep emerald) | 5.9:1 (AAA) |
| `--c-secondary` | `#0f766e` (teal) | 4.8:1 (AAA) |
| `--c-success` | `#15803d` | AA+ |
| `--c-warning` | `#b45309` | AA+ |
| `--c-danger` | `#b91c1c` | AA+ |
| `--c-info` | `#0369a1` | AA+ |
| `--c-text-primary` | `#0f172a` | 16.8:1 (AAA) |
| `--c-text-secondary` | `#1e293b` | 14.5:1 (AAA) |
| `--c-text-muted` | `#475569` | 7.6:1 (AAA) |
| `--c-border` | `#cbd5e1` | solid |

### Typography
- **Font family:** Inter (via `next/font/google`, weights 400–900), fallback stack: SF Pro Text, Segoe UI, Roboto, system-ui.
- **Scale (used in practice):**
  - Hero headline: `text-2xl font-bold` (24 px)
  - Page heading: `text-xl font-bold uppercase tracking-wider` (20 px)
  - Section heading: `text-base font-bold uppercase tracking-wider` (16 px)
  - Sub-heading: `text-sm font-bold uppercase tracking-wider` (14 px)
  - Body: `text-sm` (14 px)
  - Caption: `text-xs` (12 px)
  - Micro label: `text-[10px] font-black uppercase tracking-widest` (10 px)
- Heavy use of italic black uppercase ("ATHLETE" treatment): `text-2xl font-black italic tracking-tighter uppercase`.

### Radii
- `--radius-sm` 8 / `--radius-md` 12 / `--radius-lg` 16 / `--radius-xl` 20 / `--radius-2xl` 24 / `--radius-card` 20 / `--radius-button` 12 / `--radius-full` 9999.

### Shadows
- `--s-card` (4 px / 32 px black-40 %), `--s-card-hover` (8 px / 48 px black-50 %), `--s-glow-primary` (0/24 px primary glow), `--s-glow-secondary` (0/24 px cyan glow).

### Component primitives
- **`.glass-card`** — `border-radius:20px`, `backdrop-filter:blur(24px)`, `border:1px glass-border`, `box-shadow:s-card`, hover border + shadow lift.
- **`.stat-pill`** — rounded-full inline-flex, 0.25/0.625 rem padding, 0.75 rem text.
- **`.image-overlay`** — gradient from `--c-bg` to transparent.
- **`.glow-text`** — `text-shadow:0 0 20px primary-glow`.
- **Animations:** `neon-pulse` (2 s), `shimmer` skeleton (1.5 s), `float` (3 s), `pulse-glow` (2 s), `scan-line` (4 s — used by AnatomyMap background).
- **`prefers-reduced-motion`** — fully honoured (all animations dropped to 0.01 ms).

### shadcn/ui customisations
- `src/components/ui/chart.tsx` exists (Recharts wrapper).
- Custom `Button` (`src/components/ui-custom/Button.tsx`) with `primary | outline | ghost | danger` variants.
- Custom `Skeleton`, `Toast`/`ToastContainer`, `ConfirmationModal` (`ConfirmModal`), `DataEmptyState`.
- Tailwind v4 legacy-token bridge in `:root` maps shadcn variables (`--background`, `--primary`, `--card`, `--ring` etc.) onto Pulse Neon tokens.

---

## Page-by-Page Inventory

### Home Page (`src/pages/HomePage.tsx`)
Single-column scroll, `space-y-8`. Sections (top → bottom):

1. **Hero Welcome Card** — full-bleed `hero-athlete.jpg` with two-stop black gradient overlay. Contains:
   - "WELCOME" eyebrow with Zap icon + `glow-text`.
   - Dynamic H1: `Start Your Fitness Journey` (new user) **or** `Keep Pushing Forward` (returning user, `totalWorkouts > 0`).
   - Dynamic subhead: `crushed_workouts` count vs `track_workouts_desc`.
   - Primary CTA `Start Workout Now` → routes to `/exercises`.
2. **Newly Unlocked Achievements Toast** — conditional; primary-bordered glass card with `AchievementBadge` grid (1 or 2 cols), dismiss ✕.
3. **Quick Stats Grid** — 3 columns, glass-card tiles: **Streak** (Flame/warning), **Workouts** (Target/primary), **Volume** (TrendingUp/success), each with circular icon badge + value + label.
4. **Active Challenge Card** — warning left-border accent; shows "Reach 100 total workouts (Centurion)" + `n/100` progress.
5. **AI Workout Generator Promo** — primary-gradient-tinted glass card with Zap icon tile + `Generate` button → routes to `/wizard`.
6. **Recovery Heatmap** — `RecoveryHeatmap` component: 3-stat summary (Ready / Recovering / Just-Trained), interactive AnatomyMap with muscle buttons (20 muscles), disclosure "VIEW DETAILED STATUS".
7. **My Routines** — header with `+ Create Routine` link; if empty → dashed-border empty card with two CTAs (`Build Manually`, `Generate with AI`). If populated → 1-or-2-col glass cards each with Start button + delete trash.
8. **Popular Templates** — 1-or-2-col image cards (Push/Pull/Legs/Full-Body) with thumbnail + title overlay + `Add to My Routines` button.
9. **Recent Activity** — last 3 sessions as horizontal list rows (Dumbbell icon + name + meta + Clock); empty state with Target icon.
10. **Quick Links Grid** — 2 columns: Stats (TrendingUp/success), Body Metrics (Target/warning).

**Animations:** Framer Motion `fadeUp` variant with staggered `custom={i}` delays (0.1 s × i). Routines/templates use `scale:0.95→1` entrance. Recent rows slide in from `x:-20`.

**Gaps vs Lyfta:** No personalised greeting by name (only "Welcome to Pulse" eyebrow), no time-of-day greeting ("Good morning, …"), no streak-freeze CTA on home (only on Profile), no "next workout" continuation card, no program-overview card.

---

### AI Generator Wizard (`src/components/workout/GeneratorWizard.tsx`)
**5-step flow** (explicitly reduced from a 14-step original — see comment at line 25). Container: `max-w-md mx-auto`, glass card with `min-h-[600px]`, rounded-2rem, shadow-2xl.

**Header (sticky):** "AI GENERATOR" title + `STEP n OF 5` badge (primary/10 bg). Below: 2-px progress bar (`bg-primary`, animates width) + 5 step labels with `✓` for completed / number for current+future.

**Footer (sticky):** Back arrow (outline, flex-1) + optional `Skip` (ghost) + `Next`/`Generate Program` (primary, flex-[3], black bold uppercase tracking-widest). Generate button shows `Loader2 animate-spin` while building.

**Step transitions:** `AnimatePresence mode="popLayout"` with `x: 20 → 0` enter, `x: 0 → -20` exit (250 ms easeOut).

#### Step 1 — "Tell Us About You" (`STEP 1 OF 5`)
- Gender toggle: `MALE` / `FEMALE` compact OptionBtns (2-col).
- Age stepper: `-` button + huge italic numeric input (text-5xl) + `+` button; range 13-100; helper text below.
- "Primary Goal" — 6 full-width OptionBtns (Strength, Hypertrophy, Fat Loss, Recomp, General Fitness, Endurance), each with description. Selecting applies smart defaults (e.g. Fat Loss → 3 days/week, 45 min, includeCardio).
- "Experience Level" — 4 compact OptionBtns in 2×2 grid (Novice, Beginner, Intermediate, Advanced); auto-sets `trainingYears` (0/1/3/6).
- Validation: gender + goal + fitnessLevel required to enable Next.

#### Step 2 — "Schedule & Equipment" (`STEP 2 OF 5`)
- "Days Per Week" — 5-col grid of large italic numerals (2/3/4/5/6).
- "Session Length" — 5-col grid (30 m/45 m/1 h/1.25 h/1.5 h).
- "Where do you train?" — gym/home/outdoor compact OptionBtns.
- "Available Equipment" — 2-col multi-select (Full Gym, Bodyweight, Dumbbells, Barbell, Kettlebell, Machines, Cables, Bands).
- **Live Preview card** (primary-tinted glass card): shows Est. exercises / Est. time / Days/week in real time as user changes inputs.

#### Step 3 — "Muscles & Style" (`STEP 3 OF 5`, **optional / skippable**)
- Interactive `AnatomyMap` (2D SVG, front/back toggle, 20 muscle buttons). Tap muscles to add to `priorityMuscles`.
- Selected muscle chips (primary border) appear above style picker.
- "Workout Style" — 3-col grid: Straight Sets / Supersets / Circuits.
- Three big toggle rows: Warm-up Routine / Core Finisher / Post-Workout Cardio (checkbox-style with `CheckCircle2` when active).

#### Step 4 — "Health & Safety" (`STEP 4 OF 5`, **optional / skippable**)
- "Previous Injuries" — pill multi-select: none, lower back, knee, shoulder, elbow, wrist, neck, hip, ankle (danger-tinted when active).
- Mobility-limited checkbox row.
- Warning callout (warning/10 bg) when injuries selected: "We'll optimize your program to avoid aggravating: …".

#### Step 5 — "Ready to Generate" (`STEP 5 OF 5`)
- Check-circle header.
- **Summary card** with row separators: Goal / Experience / Schedule (`n days × m m`) / Equipment / Injuries (warning-tinted).
- **Estimated Program** card (primary-tinted): 3-col grid — `n` days/week / `~n` exercises/day / `m m` per session.
- Conditional injury warning callout.
- Single CTA: `Generate Program` (primary, flex-[3]).

**On generate:** tries AI Coach (`/api/ai-coach`) first with full user data (sessions, PRs, ACWR/MEV-MAV fatigue context); on failure falls back to heuristic `generateProgram` with raw 30 sessions + exercise map. Routes to `generator-result`.

---

### Workout Result View (`src/pages/WorkoutResultView.tsx`)
Two-column layout (`flex-col lg:flex-row`, max-w-7xl).

**Left column:**
- Title (`text-2xl font-black uppercase italic`) — program title (e.g. "Hypertrophy AI Program").
- Summary subtext.
- **Warnings panel** (if any) — warning-tinted box, `AlertTriangle` icon, dismissable ✕, bulleted list of constraints.
- **Deload Week Banner** (conditional) — gradient warning card with volume %, RPE cap, trigger reason.
- **Day Selector** (program only, >1 day) — horizontal scrollable tab strip, `Day 1/2/…`, primary underline when active.
- **Exercise list** — `AnimatePresence mode="popLayout"` motion cards. Each card: 80×80 GIF thumbnail (white bg, mix-blend-multiply), role label (compound/isolation), exercise name, **ProgressiveOverloadChip** (color-coded: New=primary, Deload=danger, Hold=warning, +Reps=success, +Δ kg=success), Plateau chip when strategy="hold". Meta row: target • sets × reps • rest seconds • tempo. Optional progressionTip with TrendingUp icon; optional note in italic.
- **Progression Model** card at bottom.

**Right column (sticky, 400 px):**
- Header with Target icon + day name + "n Muscle groups".
- **Compact AnatomyMap** (readOnly, highlighted muscles for current day).
- **Action buttons:** `Start Day n` (primary, full-width, Play icon), `Save` (ghost, Save icon), `Regen` (outline, RefreshCw, only when program).

**Gaps vs Lyfta:** No social-share button, no "preview next day" peek, no warm-up/cooldown breakdown shown, no muscle-volume-target progress bars.

---

### Workout Session Page (`src/pages/WorkoutSessionPage.tsx`)
Full-screen overlay (`absolute inset-0 z-[80] bg-bg`).

**Header:** Cancel ✕ (left) / "WORKOUT SESSION" + live timer with Clock icon (center) / Trophy + `n/total` sets counter (right).
**Progress bar:** 1-px track, gradient `primary → primary-light`, spring-animated width.
**Volume display:** centered `Total Volume: n kg` (only when >0).
**Body:** scrollable `ExerciseWorkoutCard` list with superset link connector (warning glow pill) between paired exercises.
**Footer:** "Share to Feed" checkbox + giant `Finish Workout` button (Flag icon + set count chip). Button state: disabled grey when 0 sets, success green with spinning Trophy when finishing.
**Overlays:** `RestTimer` (modal), `ConfirmModal` (cancel & finish confirmations), `PRCelebration` (mid-workout PR detection with e1RM delta), `ShareCard` (post-finish, html-to-image export).

**Sound:** `playWorkoutStartSound` on mount, `playWorkoutStopSound` on finish. Haptics: `navigator.vibrate(30)` on set completion, `[30,40,30,40,60]` on PR.
**Voice coach:** speaks "halfway" once when ≥50 % sets done, "Workout complete!" on finish.
**Confetti:** canvas-confetti in Pulse neon colors (#CCFF00, #00FFFF, #FF00FF, #00FF66), 60+60+40 particle bursts.

---

### Stats Page (`src/pages/StatsPage.tsx`)
Loading state = skeleton screens (streak card skeleton, 3-col stats skeleton, 2 chart skeletons).
Sections:
1. **Page header** — "STATS" + "Track your progress and smash your goals".
2. **Commitment Streak card** — large Flame icon (warning/15 bg), `n DAYS`, blurred warning glow background.
3. **Quick Stats Grid** (3 cols) — Workouts (Dumbbell), Total Volume (TrendingUp), Training Time (Clock).
4. **Weekly Volume & Tonnage** — Recharts **BarChart** (8 weeks, primary fill, rounded top corners).
5. **Muscle Focus** — Recharts **RadarChart** (polar grid, primary fill @ 0.4 opacity).
6. **Exercise Progress** — `ExerciseProgressChart` component: Recharts **LineChart** with exercise dropdown (sorted alphabetically), dual lines for maxWeight + e1RM.
7. **Estimated 1RM (Top 5)** — list of glass cards, cyan-400 accents.
8. **Personal Records (PRs)** — list of glass cards, Trophy warning accents, sorted by date.

All empty states use `DataEmptyState` with lucide icon + title + description.

---

### Profile Page (`src/pages/ProfilePage.tsx`)
1. **Page header** — "PROFILE" + description.
2. **Profile Card** — blurred primary glow bg, avatar (User icon in primary-muted circle), email/name, dynamic subtitle ("n completed workouts" or "Start your journey"). Ramadan 🌙 badge corner if `ramadanMode`. Two buttons: `Sync Now` (outline) + `Logout` (danger).
3. **Stats Summary** (2×2 on mobile, 4-col on sm) — Workouts / Streak (with `FREEZE` pill button) / Weight / Volume. Volume auto-formats to k/M.
4. **Personal Records (1RM)** — header with Trophy; 1-or-2-col cards: exercise name, `n kg × n reps`, date, est. 1RM with pulsing TrendingUp icon. Empty state text if none.
5. **Achievements** — 2-or-3-col grid of `AchievementBadge` components (7 achievements total: First Steps, Momentum, Unstoppable, Heavy Lifter, Centurion, Night Owl, Early Bird).
6. **Menu Items** — 3 link rows (Body Metrics, Progress Photos, Settings) with icon tile + label + description + chevron.
7. **Ramadan Banner** (conditional) — 🌙 + "Ramadan Mubarak" + "Stay fit this Ramadan".
8. **Footer** — "Pulse v1.0.0" centered.

---

### Settings Page (`src/pages/SettingsPage.tsx`)
Sections (each a glass card with header + icon):
1. **Page header** — "SETTINGS" + back arrow.
2. **App Theme** — 3-col segmented control: Light / Dark / System (Sun / Moon / Monitor icons).
3. **Ramadan Mode 🌙** — toggle.
4. **Rest Duration** — 4-col: 1 m / 1.5 m / 2 m / 3 m (Timer icon).
5. **Weight Unit** — 2-col: Kilograms / Pounds (Scale icon).
6. **Notifications** — toggle (Bell icon) + permission prompt.
7. **Sound Effects** — toggle (Volume2 icon).
8. **Voice Coach 🎙️** — master toggle + Voice dropdown (system voices) + `Test Voice` + `Stop` buttons. Helper text: "Spoken cues for rest, PRs, and milestones… Works offline. Cues fire on rest completion, new PRs, set completion, the halfway mark, and workout completion."
9. **Cloud Sync** — toggle + status (Cloud icon, shows online/offline/syncing/error).
10. **Data Backup** — `Export` (JSON download) + `Import` (file picker) buttons (DatabaseBackup icon).
11. **Footer** — "CRAFTED WITH ⚡ FOR THE FITNESS COMMUNITY".

---

### Auth Page (`src/pages/AuthPage.tsx`)
Full-screen, no nav. Hero image (`/images/auth-bg.jpg`) at top (h-72) with gradient overlay + Pulse logo (Zap in primary square) + tagline "Push your limits. Track every rep." Form below: toggle Login/Create Account, email + password fields, submit button, Google sign-in button, "Continue as guest" link. Local-only auth (any email/password works; stored in localStorage).

---

### Layout / Bottom Nav (`src/components/layout/Layout.tsx`)
- Constrained to `max-w-md` (mobile-first phone frame on desktop).
- **Top-left:** floating "CHALLENGES" pill link (Trophy icon).
- **Top-right:** floating Cloud sync indicator (colored dot + status text).
- **Main:** scrollable with `pb-safe`, scroll-to-top button appears after 300 px.
- **Bottom nav:** 6 items — Home, Exercises, Feed, Nutrition, Stats, Profile. Each `NavItem` shows: top indicator bar (scale-x + glow when active), background pill (`bg-primary-dim`), icon (22 px, 2.75 stroke when active), label (bold when active). Haptic on tap.

---

## 3D vs 2D

**AnatomyMap is 2D SVG** — definitively confirmed.

**Evidence:**
- `src/components/AnatomyMap.tsx` line 795-812: renders `<svg viewBox={vb} xmlns="http://www.w3.org/2000/svg">` containing `<defs>` (GaussianBlur filter) + `<path>` elements for body outline and muscle groups.
- Two SVG datasets inlined: `FRONT` (line 20) and `BACK` (line 260) — each `MuscleGroup[]` with `paths: string[]` (raw SVG path data), `color`, `glow`, `exercises`.
- `viewBox="0 0 676.49 1203.49"` for both views.
- Zero imports of `three`, `@react-three/fiber`, `@react-three/drei`, `WebGL`, `GLTFLoader`, or `useThree` anywhere in `src/` (grep returned only one false-positive match — the word "three" inside `src/app/api/challenges/route.ts` referring to "three default challenges").
- `package.json` has no 3D dependencies — only `framer-motion` (animation) and `recharts` (charts).
- Performance test in `src/components/AnatomyMap.performance.test.tsx` reports 2.57 ms render — consistent with SVG, not WebGL.

**Interactivity:** tappable muscle buttons (20 muscles per view), front/back toggle, tooltip card with muscle name + sub-name + exercise chips, "Clear Selection" button, scan-line animation overlay (`anatomy-scan-line` CSS class).

---

## Charts Available

| Chart type | Library | Location | Purpose |
|---|---|---|---|
| **BarChart** | recharts | `StatsPage.tsx` | Weekly volume & tonnage (8-week) |
| **RadarChart** | recharts | `StatsPage.tsx` | Muscle focus distribution (per-muscle volume) |
| **LineChart** | recharts | `src/components/stats/ExerciseProgressChart.tsx` (used in StatsPage) | Per-exercise max weight + e1RM over time |
| **LineChart** | recharts | `src/pages/BodyPage.tsx` | Body measurement trends (weight, etc.) |
| **LineChart** | recharts | `src/pages/ExerciseDetailPage.tsx` | Single-exercise progress history |
| **RecoveryHeatmap** | custom (AnatomyMap + colored muscle fills) | `src/components/RecoveryHeatmap.tsx` (used in HomePage) | Per-muscle recovery status (Ready / Recovering / Just-Trained) |

**Total: 5 distinct chart types** (Bar, Radar, Line ×3 contexts, plus the anatomy-based heatmap).

No pie/donut charts, no area charts, no radial-bar charts, no heatmaps in the traditional grid sense.

---

## Social Proof Elements

### What exists
- **Active Challenge card** on Home — shows "Reach 100 total workouts (Centurion)" with `n/100` progress (single challenge, no social comparison).
- **Challenges page** (`/challenges`) — list of 3 default challenges (Centurion 10 k, Iron Titan 50 k, Hypertrophy Hero 100 k) with join + leaderboard.
- **Feed page** (`/feed`) — social post feed with kudos + comments (backed by Prisma/SQLite API routes).
- **Share Card** post-workout — html-to-image export of session summary (date, duration, volume, exercises, sets, streak) + "Share to Feed" toggle.

### What's missing (vs Lyfta-style social proof)
- **No testimonials / reviews** anywhere in the app.
- **No user count badge** ("Join 50,000+ athletes").
- **No rating / app-store stars**.
- **No featured transformation stories**.
- **No friend activity feed on Home** (only dedicated `/feed` page).
- **No "X people completed this workout" indicator** on workout results.
- **No follow suggestions / "people you may know"**.
- **No leaderboard preview on Home** (must navigate to `/challenges`).

---

## Psychological Design

### What exists (gamification + retention hooks)
| Hook | Implementation |
|---|---|
| **Streak counter** | Home quick-stat (Flame), Stats large card, Profile tile, WorkoutSession header |
| **Streak Freeze** | Profile "FREEZE" pill button → inserts `isFreeze: true` placeholder session |
| **Achievements** | 7 badges (First Steps, Momentum, Unstoppable, Heavy Lifter, Centurion, Night Owl, Early Bird), newly-unlocked toast on Home, badge grid on Profile |
| **PR celebration** | Mid-workout `PRCelebration` modal with e1RM delta, confetti, haptic pattern, voice announcement |
| **Confetti** | canvas-confetti on workout finish (neon colors, 60+60+40 particles) |
| **Sound feedback** | Start/stop sounds + voice coach cues (halfway, PR, completion) |
| **Haptic feedback** | `navigator.vibrate(30)` set complete, `[30,40,30,40,60]` on PR, `50` on nav tap |
| **Progress bar** | WorkoutSession spring-animated 1-px gradient bar |
| **Recovery visualization** | AnatomyMap with color-coded muscle readiness (Ready=green, Recovering=amber, Just-Trained=red) |
| **Smart defaults** | Wizard auto-fills days/length/cardio based on selected goal (reduces friction) |
| **Live preview** | Step 2 of wizard shows real-time est. exercises/time/days as user toggles inputs |
| **Deload recommendation** | WorkoutResultView banner when ACWR > 1.5 (volume %, RPE cap, trigger) |
| **Progressive overload chips** | Each exercise card shows +Δ kg / +Reps / Hold / Deload / New badge |
| **Plateau detection** | Warning chip when 3-session trend is flat |
| **Voice coach** | TTS cues at halfway, PR, set complete, workout complete (offline, system voices) |

### What's missing (vs Lyfta-level psychological design)
- **No splash screen** (zero matches for `splash`, `SplashScreen`, `intro_screen`, `WelcomeScreen`).
- **No multi-step onboarding flow** — AuthPage is the only entry; new users land directly on Home with empty state.
- **No social proof screens** (testimonials, user counts, ratings).
- **No feature teasers** between wizard steps (straight step→step transitions).
- **No personalised greeting** by name or time-of-day ("Good morning, Ahmed").
- **No "next workout" continuation card** on Home.
- **No program overview / weekly schedule card** on Home.
- **No push notification prompts** for re-engagement (only basic notification permission toggle in Settings).
- **No daily streak-freeze reward animations** (just a plain pill button).
- **No leaderboard rank badges / tiers** (just numeric position).
- **No comparison-to-others ("You're in the top X %")**.
- **No milestone celebration videos / animations** (only confetti + modal).
- **No "before/after" progress photo carousel** on Home.
- **No achievement progress bars** (badges show unlocked/locked binary state, no "3/7 workouts toward Unstoppable").

---

## Wizard step count: Pulse (5) vs Lyfta (16)

Pulse's `GeneratorWizard.tsx` declares at line 25:
```ts
// 5-STEP WIZARD (reduced from 14 steps)
const STEPS = ["Goal & Experience", "Schedule & Equipment", "Muscles & Style", "Health & Safety", "Review"];
```

- **Pulse: 5 steps** (was 14 in original Vite source — already reduced).
- **Lyfta: 16 steps** (per task brief).
- **Gap: 11 steps** — Pulse aggressively merges related inputs (gender+age+goal+experience → step 1; days+length+location+equipment → step 2). Two steps are explicitly skippable (Muscles & Style, Health & Safety). The trade-off: faster to complete (good for conversion) but less data captured per step (less personalization signal).

---

## Biggest Gaps vs Lyfta (Summary)

1. **No 3D anatomy model** — Pulse uses a 2D SVG (947 lines, viewBox 676×1203). Lyfta uses a 3D rotating model. Visual impact gap is significant.
2. **No onboarding flow** — no splash, no welcome carousel, no social proof screens, no feature teasers. New users hit Home with empty state immediately.
3. **5 wizard steps vs 16** — less granular personalization signal captured.
4. **No personalised greeting** by name or time-of-day on Home.
5. **No social proof elements** anywhere (no testimonials, user counts, friend activity on Home).
6. **No program-overview / weekly-schedule card** on Home — users can't see their current program at a glance.
7. **Limited chart variety** — 4 distinct chart types (Bar, Radar, Line, Anatomy-heatmap) vs Lyfta's richer analytics (likely includes pie, area, radial-bar, calendar heatmap).
8. **Achievement badges lack progress indicators** — binary locked/unlocked, no "3/7 toward Unstoppable".
9. **No leaderboard rank badges / tiers** — just numeric position.
10. **No "next workout" continuation card** — users must manually navigate to routines.
