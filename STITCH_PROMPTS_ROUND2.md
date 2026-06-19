# 🎨 Stitch-Ready Prompts للصفحات المتبقية

---

## 1. Stitch Prompt: Feed Page (صفحة المجتمع)

```
Redesign the Feed/Social page for "Pulse Fitness" — a dark-mode fitness app with lime neon identity.

LAYOUT & STRUCTURE:
- Dark background (#050505), max-w-md (mobile-first), p-4, space-y-4
- Top header: "FEED" title (text-2xl font-black italic uppercase) + subtitle "See what your friends are lifting" (text-xs, #9ca3af)

SECTION 1 — Post Creation Prompt (if user has recent workouts):
- Glass card with primary left-border accent (border-l-4 border-l-primary)
- "Share your latest workout?" text + "Share" button (primary, small)

SECTION 2 — Feed Posts (vertical list):
- Each post is a glass card (rounded-2xl, p-4, border, backdrop-blur):
  * Header: avatar (40px circle) + author name (text-sm font-bold) + date (text-[10px] uppercase tracking-widest) + DELETE button (trash icon, right-aligned, only for post author)
  * Workout summary card (bg-bg-elevated/40, rounded-xl, p-3):
    - Workout title (text-sm font-black capitalize)
    - 3 stats in a row: Duration (Clock icon, primary), Exercises count (Dumbbell icon, cyan), Volume (Activity icon, warning)
  * Action bar: Kudos button (Heart icon + count) + Comments button (MessageSquare icon + count)
  * Comments section (expandable): list of comments with author avatar + text + delete button (for comment author)

SECTION 3 — Following/Followers:
- Horizontal scroll of followed users with avatar + name
- Search bar to find new users

SECTION 4 — Empty State:
- Use "KineticEmptyState" with Search icon variant
- "Feed is quiet" title + "Be the first to share your workout!" description + "Start Workout" button

VISUAL IDENTITY:
- Pure dark mode (#050505)
- Lime neon (#ccff00) for primary actions, kudos
- Cyan (#00f0ff) for exercise counts
- Warning (#ffab00) for volume
- Danger (#ff5252) for delete buttons
- Glass cards with inset highlight + hover lift
- Inter font, italic black for titles

ANIMATIONS:
- Posts: staggered slide-in from bottom (y: 20 → 0)
- Kudos: heart pulse on tap
- Comments: expand/collapse with height animation
- Delete: fade-out + slide-left exit animation
- Hover: cards lift (translate-y -1px)

TECH: React + TypeScript + Tailwind CSS v4 + Framer Motion, max-w-md mobile-first
```

---

## 2. Stitch Prompt: Nutrition Page (صفحة التغذية)

```
Design a Nutrition/Calorie Tracking page for "Pulse Fitness" — a dark-mode fitness app with lime neon identity.

LAYOUT & STRUCTURE:
- Dark background (#050505), max-w-md (mobile-first), p-4, space-y-5

SECTION 1 — Daily Calorie Ring:
- Large circular progress ring (200px diameter) centered at top
- Ring shows calories consumed vs goal (e.g., 1450 / 2200 kcal)
- Ring color: lime neon (#ccff00) when under goal, warning (#ffab00) when close, danger (#ff5252) when over
- Center text: "1450" (text-4xl font-black italic tabular-nums) + "kcal" (text-xs) + "of 2200" (text-[10px] text-secondary)
- Below ring: 3 macro bars (Protein / Carbs / Fat) with colored fills + gram counts

SECTION 2 — Macro Breakdown (3 cards in a row):
- 3 glass cards (grid-cols-3, gap-3):
  * Protein: Dumbbell icon (primary), "120g" (text-lg font-black), "PROTEIN" label, progress bar
  * Carbs: Activity icon (secondary cyan), "180g" (text-lg), "CARBS" label, progress bar
  * Fat: Flame icon (warning), "55g" (text-lg), "FAT" label, progress bar

SECTION 3 — Meals List:
- "MEALS" header (text-xs font-bold uppercase tracking-widest) + "Add Meal" button (primary, small, Plus icon)
- 3-4 meal cards (glass cards, rounded-xl, p-4):
  * Breakfast: Sun icon (warning) + "Breakfast" title + "420 kcal" + 3 food items as chips
  * Lunch: Sun icon (primary) + "Lunch" title + "650 kcal" + food items
  * Snack: Coffee icon (secondary) + "Snack" + "180 kcal"
  * Dinner: Moon icon (info) + "Dinner" + "200 kcal" (empty state)
- Each meal card expandable to show food items with calorie counts

SECTION 4 — Quick Add:
- Floating action area at bottom: "Quick Add" button (primary, full-width, Plus icon)
- Opens a sheet to add food by name + calories + macros

SECTION 5 — Water Tracker:
- Glass card with water drop icon + "WATER" label + 8 droplet icons (filled/empty based on intake)
- "6/8 glasses" text + tap to add a glass

SECTION 6 — Empty State:
- If no meals logged: KineticEmptyState with "measurements" variant
- "Track your nutrition" title + "Log your first meal to see daily breakdowns" + "Add Meal" button

VISUAL IDENTITY:
- Pure dark mode (#050505)
- Lime neon (#ccff00) for calories, protein
- Cyan (#00f0ff) for carbs
- Warning (#ffab00) for fat, water
- Glass cards with inset highlight
- Circular progress with SVG stroke-dasharray
- Tabular nums for all numbers

ANIMATIONS:
- Calorie ring: animate stroke-dashoffset on mount
- Macro bars: grow from 0 to value (staggered)
- Meal cards: staggered fade-up
- Water droplets: pop-in animation on tap
- Hover: cards lift

TECH: React + TypeScript + Tailwind CSS v4 + Framer Motion + Recharts (for ring), max-w-md mobile-first
```

---

## 3. Stitch Prompt: AI Generator Wizard (إعادة تصميم)

```
Redesign the AI Workout Generator wizard for "Pulse Fitness" — a dark-mode fitness app.

LAYOUT & STRUCTURE:
- Full-screen dark overlay (#050505) with a centered glass card (max-w-md, rounded-[2rem], p-6)
- Exit button (X icon, top-left, navigates back to home)
- Header: "AI GENERATOR" title + "STEP X OF 5" badge (primary bg)
- Progress bar: 2px lime neon, animates width
- Step labels: 5 circles with numbers (completed = ✓ success, current = primary, future = muted)

STEP 1 — "TELL US ABOUT YOU":
- Gender: 2 compact centered buttons (MALE / FEMALE) with icons
- Age: stepper with - and + buttons, large centered number (text-5xl italic black)
- Primary Goal: 6 full-width centered option buttons (each with label + description)
- Experience Level: 4 compact centered buttons in 2x2 grid

STEP 2 — "SCHEDULE & EQUIPMENT":
- Days Per Week: 5 large centered number buttons (2/3/4/5/6) with ✓ badges on 3/4/5
- Commitment: "How long can you commit?" with 3 options (1mo/3mo/1yr) + visual bar chart
- Session Length: 5 compact buttons (30m/45m/1h/1.25h/1.5h)
- Location: 3 compact buttons (gym/home/outdoor)
- Equipment: multi-select 2-col grid (Full Gym/Bodyweight/Dumbbells/Barbell/Kettlebell/Machines/Cables/Bands)
- Live Preview card: shows estimated exercises/time/days in real-time

STEP 3 — "MUSCLES & STYLE" (optional):
- Interactive AnatomyMap (3D rotation effect, front/back toggle)
- Selected muscle chips above style picker
- Workout Style: 3-col grid (Straight Sets/Supersets/Circuits)
- 3 toggle rows: Warm-up / Core Finisher / Post-Workout Cardio

STEP 4 — "HEALTH & SAFETY" (optional):
- Injuries: pill multi-select (none/lower back/knee/shoulder/elbow/wrist/neck/hip/ankle)
- Mobility-limited checkbox
- Warning callout when injuries selected

STEP 5 — "READY TO GENERATE":
- Summary card with all selections
- Estimated program card (days/week × exercises/day × min/session)
- "GENERATE PROGRAM" button (full-width, primary, lime neon glow)

FOOTER:
- Back button (outline, left)
- Skip button (ghost, center, only on optional steps)
- Next/Generate button (primary, right, flex-[3])

FEATURE TEASERS (between steps):
- After Step 1: "AI Coach Ready" overlay (Sparkles icon, lime glow)
- After Step 3: "PR Celebrations" overlay (Trophy icon, gold glow)

VISUAL IDENTITY:
- All option buttons: CENTERED text (text-center), not left-aligned
- Pure dark mode (#050505)
- Lime neon (#ccff00) for active states, progress bar, CTAs
- Glass card with backdrop-blur + border + shadow
- Inter font, italic black for headings
- Exit (X) button always visible top-left

ANIMATIONS:
- Step transitions: horizontal slide (x: 20 → 0)
- Feature teasers: spring scale-in + glow pulse
- Progress bar: smooth width animation
- Button taps: scale 0.98
- Option selection: border + bg color change with spring

TECH: React + TypeScript + Tailwind CSS v4 + Framer Motion, max-w-md mobile-first
```
