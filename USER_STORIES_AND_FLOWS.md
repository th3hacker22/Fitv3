# 📋 Pulse Fitness — User Stories & User Flow (Complete)

> **Purpose:** This document maps the ENTIRE user journey from app open to every feature. Send this to an AI to identify gaps and propose improvements.

---

## 📖 User Stories

### Epic 1: Onboarding & Authentication

**US 1.1 — Splash Screen**
> As a new user, when I open the app, I want to see a branded splash screen with the Pulse logo and tagline, so that I feel I'm entering a premium fitness experience.

**US 1.2 — Onboarding Carousel**
> As a new user, I want to see 4 onboarding slides explaining the app's key features (AI Workouts, PR Tracking, 2M Sets Tracked, Join 50K Athletes), so that I understand the value before signing up.

**US 1.3 — Name Input**
> As a new user, after the marketing slides, I want to enter my name, so that the app can greet me personally on the home page.

**US 1.4 — Authentication**
> As a user, I want to log in with Google or email, or continue as guest, so that I can access the app.

**US 1.5 — Notification Permission**
> As a new user, after completing onboarding, I want to be asked for notification permission, so that I can receive workout reminders and PR alerts.

---

### Epic 2: Home Dashboard

**US 2.1 — Personalized Greeting**
> As a logged-in user, I want to see "Good morning/afternoon/evening, [NAME]" on the home page, so that the app feels personal.

**US 2.2 — Quick Stats**
> As a user, I want to see my Streak, total Workouts, and Volume at a glance, so that I can track my progress without navigating to Stats.

**US 2.3 — Next Workout Card**
> As a user with an active program, I want to see my next workout (day name + exercise count + estimated time), so that I can resume my program quickly.

**US 2.4 — AI Generator Promo**
> As a user, I want a prominent "AI Workout Generator" card with a "Generate Plan" button, so that I can create a new personalized workout.

**US 2.5 — Active Challenge**
> As a user participating in challenges, I want to see my active challenge with goal progress, so that I stay motivated.

**US 2.6 — Recovery Status**
> As a user, I want to see a recovery heatmap showing which muscles are ready vs fatigued, so that I can plan my training intelligently.

**US 2.7 — My Routines**
> As a user, I want to see my saved routines with a Start button, so that I can quickly begin a workout.

**US 2.8 — Popular Templates**
> As a user, I want to see popular workout templates (Push/Pull/Legs/Full Body) that I can add to my routines with one tap.

**US 2.9 — Recent Activity**
> As a user, I want to see my last 3 workouts with volume and date, so that I can see my recent training history.

**US 2.10 — Quick Links**
> As a user, I want quick access to Stats and Body Metrics from the home page.

---

### Epic 3: AI Workout Generator

**US 3.1 — Step 1: Goal & Experience**
> As a user, I want to select my gender, age, primary goal, and experience level, so that the AI can personalize my workout.

**US 3.2 — Step 2: Schedule & Equipment**
> As a user, I want to choose days/week, session length, location, and available equipment, so that the workout fits my schedule and resources.

**US 3.3 — Commitment Psychology**
> As a user, I want to see a "How long can you commit?" section with a visual chart showing 3 months >> few weeks, so that I'm psychologically motivated to commit longer.

**US 3.4 — Step 3: Muscles & Style**
> As a user, I want to select target muscles on an interactive anatomy map and choose my training style (straight sets/supersets/circuits), so that the workout targets my priorities.

**US 3.5 — Step 4: Health & Safety**
> As a user, I want to specify injuries and mobility limitations, so that the workout avoids aggravating my conditions.

**US 3.6 — Step 5: Review & Generate**
> As a user, I want to see a summary of all my selections and an estimated program scope, then click "Generate Program" to create my plan.

**US 3.7 — Feature Teasers**
> As a user, between wizard steps, I want to see feature teasers (AI Coach Ready, PR Celebrations), so that I'm educated about app features.

**US 3.8 — Exit Wizard**
> As a user, I want an exit (X) button in the wizard, so that I can leave without completing it.

**US 3.9 — Multi-Day Generation**
> As a user who selected 5 days/week, I want the generated program to have 5 days (not just 1), so that I have a complete weekly plan.

---

### Epic 4: Workout Result & Program

**US 4.1 — Program Overview**
> As a user, after generation, I want to see the program title, summary, and all days, so that I can review the plan.

**US 4.2 — Day Selector**
> As a user with a multi-day program, I want to switch between days, so that I can see each day's exercises.

**US 4.3 — Exercise Cards with Progressive Overload**
> As a user, I want each exercise card to show: name, sets × reps, rest, tempo, and a progressive overload chip (New/+kg/+Reps/Hold/Deload), so that I know how to progress.

**US 4.4 — Progression Tips**
> As a user, I want a progression tip below each exercise, so that I know the strategy for that exercise.

**US 4.5 — Deload Week Banner**
> As a user with high fatigue, I want to see a deload week banner with volume %, RPE cap, and trigger reason, so that I know when to back off.

**US 4.6 — Anatomy Map per Day**
> As a user, I want to see which muscles each day targets on an anatomy map, so that I can visualize the training split.

**US 4.7 — Start Workout**
> As a user, I want to start a specific day's workout, so that I begin training.

**US 4.8 — Regenerate**
> As a user, I want to regenerate the program with a new seed, so that I get a different variation.

**US 4.9 — Save Routine**
> As a user, I want to save the current program as a routine, so that I can reuse it later.

---

### Epic 5: Workout Session

**US 5.1 — Live Timer**
> As a user in a workout, I want to see a live timer, so that I know how long I've been training.

**US 5.2 — Progress Bar**
> As a user, I want to see a progress bar showing completed/total sets, so that I know how much is left.

**US 5.3 — Set Logging**
> As a user, I want to log weight, reps, and RPE for each set, so that my workout data is saved.

**US 5.4 — Ghost Logging (Previous Data)**
> As a user, I want to see my previous weight/reps for each exercise, so that I know what to aim for.

**US 5.5 — RPE Color Coding**
> As a user, I want the RPE input to be color-coded (green ≤7, yellow 8, orange 9, red 10), so that I can quickly gauge intensity.

**US 5.6 — Smart Rest Timer**
> As a user, I want a rest timer that auto-suggests duration based on exercise type + RPE, so that I rest optimally.

**US 5.7 — Rest Timer Controls**
> As a user, I want quick-adjust buttons (-15s/+15s/+30s/+60s) on the rest timer, so that I can extend or shorten rest.

**US 5.8 — Voice Coach**
> As a user, I want spoken cues for rest complete, 15s left, new PR, set complete, halfway, and workout complete, so that I don't need to look at the screen.

**US 5.9 — PR Celebration**
> As a user, when I hit a new PR mid-workout, I want a confetti modal with trophy + exercise name + weight, so that I feel celebrated.

**US 5.10 — Warmup Calculator**
> As a user, I want to see suggested warmup sets (RAMP protocol) for each exercise, so that I prepare properly.

**US 5.11 — Plate Calculator**
> As a user doing barbell exercises, I want to see which plates to load on each side, so that I don't have to calculate manually.

**US 5.12 — Smart Skip**
> As a user, I want to skip an exercise with a reason (too tired/equipment busy/pain/don't like/time/other), so that the Learning Loop can personalize future workouts.

**US 5.13 — Superset Linking**
> As a user, I want superset exercises to be visually linked, so that I know to do them back-to-back.

**US 5.14 — Finish Workout**
> As a user, I want to finish my workout with a confirmation, so that it saves properly.

**US 5.15 — Share Card**
> As a user, after finishing, I want a share card with my workout summary, so that I can share to the feed or social media.

---

### Epic 6: Stats & Analytics

**US 6.1 — Streak Card**
> As a user, I want to see my current streak with a 7-day mini heatmap, so that I'm motivated to keep going.

**US 6.2 — Quick Stats**
> As a user, I want to see total Workouts, Volume, and Training Time, so that I understand my cumulative progress.

**US 6.3 — Weekly Volume Chart**
> As a user, I want a bar chart of my weekly volume over 8 weeks, so that I can see trends.

**US 6.4 — Muscle Volume Map**
> As a user, I want an interactive anatomy map showing which muscles I've trained most, so that I can detect imbalances.

**US 6.5 — Imbalance Warning**
> As a user, if a muscle group is under-trained (<30%), I want a red warning badge, so that I can correct it.

**US 6.6 — Exercise Progress Chart**
> As a user, I want a line chart showing my weight and 1RM progress for a specific exercise over time, so that I can see strength gains.

**US 6.7 — Personal Records**
> As a user, I want a list of my PRs with exercise name, weight, and 1RM, so that I can track my best lifts.

**US 6.8 — Calendar Heatmap**
> As a user, I want a GitHub-style calendar heatmap showing my workout consistency over 12 weeks, so that I can visualize my dedication.

---

### Epic 7: Profile & Achievements

**US 7.1 — Profile Card**
> As a user, I want to see my avatar, name, email, and total workouts, so that I have a personal identity in the app.

**US 7.2 — Avatar Upload**
> As a user, I want to upload a profile photo from camera or gallery, so that my profile is personalized.

**US 7.3 — Stats Summary**
> As a user, I want 4 stat tiles (Workouts/Streak/Weight/Volume) with trends, so that I see key metrics at a glance.

**US 7.4 — Achievement Badges**
> As a user, I want to see achievement badges with colors when unlocked and progress bars when locked, so that I'm motivated to unlock them.

**US 7.5 — Personal Records List**
> As a user, I want to see my top 3 PRs with 1RM badges, so that I can be proud of my achievements.

**US 7.6 — Menu Navigation**
> As a user, I want menu items for Body Metrics, Progress Photos, and Settings, so that I can navigate to related features.

**US 7.7 — Sync & Logout**
> As a user, I want to sync my data to cloud and logout, so that my data is safe and I can switch accounts.

---

### Epic 8: Social & Community

**US 8.1 — Feed**
> As a user, I want to see a feed of workouts shared by people I follow, so that I stay motivated by their activity.

**US 8.2 — Share Workout**
> As a user, after finishing a workout, I want to share it to the feed, so that my followers can see my progress.

**US 8.3 — Kudos**
> As a user, I want to give kudos (likes) to others' workouts, so that I can show support.

**US 8.4 — Comments**
> As a user, I want to view and add comments on feed posts, so that I can engage with the community.

**US 8.5 — Delete Post**
> As a user, I want to delete my own posts, so that I can remove content I no longer want.

**US 8.6 — Delete Comment**
> As a user, I want to delete my own comments, so that I can remove content I no longer want.

**US 8.7 — Search Athletes**
> As a user, I want to search for other athletes by name, so that I can find and follow them.

**US 8.8 — Follow/Unfollow**
> As a user, I want to follow and unfollow other athletes, so that I curate my feed.

**US 8.9 — Challenges**
> As a user, I want to join challenges with volume goals and see leaderboards, so that I can compete.

---

### Epic 9: Nutrition Tracking

**US 9.1 — Calorie Ring**
> As a user, I want to see a circular ring showing my daily calorie consumption vs goal, so that I stay on track.

**US 9.2 — Macro Breakdown**
> As a user, I want to see Protein/Carbs/Fat with progress bars, so that I hit my macro targets.

**US 9.3 — Meal Logging**
> As a user, I want to log food entries by meal type (breakfast/lunch/dinner/snack), so that I track what I eat.

**US 9.4 — Add Food**
> As a user, I want a "Quick Add" button to add food with name, calories, and macros, so that logging is fast.

**US 9.5 — Delete Food Entry**
> As a user, I want to delete food entries, so that I can correct mistakes.

**US 9.6 — Date Navigation**
> As a user, I want to navigate between days, so that I can log and review past meals.

**US 9.7 — Edit Goals**
> As a user, I want to edit my calorie and macro goals, so that my targets are accurate.

**US 9.8 — Macro Calculator**
> As a user, I want a BMR-based macro calculator (weight/height/age/gender/activity/goal), so that I can get science-based targets.

**US 9.9 — Water Tracker**
> As a user, I want to track my water intake with 8 droplet icons, so that I stay hydrated. *(⚠ Currently non-functional — no onClick handler)*

---

### Epic 10: Exercise Library

**US 10.1 — Browse Exercises**
> As a user, I want to browse all exercises with images, so that I can find new exercises.

**US 10.2 — Search Exercises**
> As a user, I want to search exercises by name, so that I can find specific movements quickly.

**US 10.3 — Filter Exercises**
> As a user, I want to filter by body part and equipment, so that I find exercises matching my setup.

**US 10.4 — Exercise Detail**
> As a user, I want to tap an exercise to see instructions, target muscles, and progress history, so that I learn proper form.

**US 10.5 — Custom Exercise**
> As a user, I want to create custom exercises, so that I can log workouts not in the library.

---

### Epic 11: Routine Builder

**US 11.1 — Create Routine**
> As a user, I want to create a custom routine by selecting exercises, sets, reps, and rest, so that I have a reusable workout plan. *(⚠ Builder page needs: name input + photo upload + anatomy-based exercise filtering)*

**US 11.2 — Name & Photo**
> As a user, I want to name my routine and optionally add a photo from gallery, so that it's easy to identify.

**US 11.3 — Anatomy-Based Filtering**
> As a user, I want to filter exercises by selecting muscles on the anatomy map, so that I build a targeted routine.

---

### Epic 12: Body Metrics

**US 12.1 — Log Measurements**
> As a user, I want to log my weight, body fat, and measurements, so that I track physical changes.

**US 12.2 — Progress Photos**
> As a user, I want to take progress photos, so that I can visually compare my transformation.

**US 12.3 — Trends Chart**
> As a user, I want a line chart of my weight over time, so that I see trends.

---

### Epic 13: Settings

**US 13.1 — Theme**
> As a user, I want to switch between Light/Dark/System themes.

**US 13.2 — Ramadan Mode**
> As a user, I want a Ramadan mode that adjusts the app for fasting.

**US 13.3 — Rest Duration**
> As a user, I want to set my default rest duration (1m/1.5m/2m/3m).

**US 13.4 — Weight Unit**
> As a user, I want to toggle between kg and lbs.

**US 13.5 — Notifications**
> As a user, I want to enable/disable push notifications.

**US 13.6 — Sound Effects**
> As a user, I want to enable/disable workout sound effects.

**US 13.7 — Voice Coach**
> As a user, I want to enable/disable the voice coach and select a voice.

**US 13.8 — Cloud Sync**
> As a user, I want to enable cloud sync and see sync status.

**US 13.9 — Data Backup**
> As a user, I want to export and import my data as JSON.

---

## 🗺️ Complete User Flow

### Flow 1: First-Time User (New Installation)

```
1. Open app
   ↓
2. Splash Screen (2.5s)
   - "PULSE" logo + "PUSH YOUR LIMITS. TRACK EVERY REP."
   - Loading bar animation
   ↓
3. Onboarding Carousel (5 screens)
   3a. "AI-Powered Workouts" (lime neon) → Continue
   3b. "Track Every PR" (gold) → Continue
   3c. "2M+ Sets Tracked" (green, social proof) → Continue
   3d. "Join 50,000+ Athletes" (cyan, community) → Continue
   3e. "What's your name?" → Enter name → Start Training
   ↓
4. Notification permission request (browser popup)
   ↓
5. Auth Page
   - Login / Create Account toggle
   - Email + Password fields
   - "Continue with Google" button
   - "Continue as Guest" link
   ↓
6. Home Page (logged in)
   - "Good [morning/afternoon/evening], [NAME]"
   - Quick Stats (Streak=0, Workouts=0, Volume=0)
   - AI Generator Promo
   - Recovery Status (all 39 muscles "Ready")
   - My Routines (empty state)
   - Popular Templates (Push/Pull/Legs/Full Body)
   - Recent Activity (empty state)
   - Quick Links (Stats, Body Metrics)
```

### Flow 2: AI Workout Generation

```
1. Home → Click "GENERATE PLAN"
   ↓
2. AI Generator Wizard (5 steps)
   Step 1: Tell Us About You
     - Select Gender (Male/Female)
     - Set Age (stepper ±1)
     - Select Goal (Strength/Hypertrophy/Fat Loss/Recomp/General/Endurance)
     - Select Experience (Novice/Beginner/Intermediate/Advanced)
     → Click "Next"
   ↓
   Feature Teaser: "AI Coach Ready" → Continue
   ↓
   Step 2: Schedule & Equipment
     - Select Days/Week (2-6, with ✓ on 3/4/5)
     - Commitment Psychology (1mo/3mo/1yr + bar chart)
     - Select Session Length (30m-90m)
     - Select Location (gym/home/outdoor)
     - Select Equipment (multi-select)
     - Live Preview (est. exercises/time/days)
     → Click "Next"
   ↓
   Step 3: Muscles & Style (optional, skippable)
     - Tap muscles on AnatomyMap (interactive 3D rotation)
     - Select Training Style (Straight Sets/Supersets/Circuits)
     - Toggle Warm-up / Core Finisher / Cardio
     → Click "Next"
   ↓
   Feature Teaser: "PR Celebrations" → Continue
   ↓
   Step 4: Health & Safety (optional, skippable)
     - Select Injuries (multi-select pills)
     - Toggle Mobility Limited
     → Click "Next"
   ↓
   Step 5: Ready to Generate
     - Summary card (all selections)
     - Estimated program (days × exercises × time)
     - Click "GENERATE PROGRAM"
   ↓
3. Loading (AI Coach call / heuristic fallback)
   ↓
4. Workout Result View
   - Program title + summary
   - Deload banner (if ACWR > 1.5)
   - Day selector (Day 1-5 based on daysPerWeek)
   - Exercise cards with:
     * Progressive Overload chips (New/+kg/+Reps/Hold/Deload)
     * Progression tips
     * Sets × Reps × Rest × Tempo
   - AnatomyMap showing day's target muscles
   - "Start Day X" / "Save" / "Regen" buttons
```

### Flow 3: Active Workout Session

```
1. Workout Result → Click "Start Day X"
   ↓
2. Workout Session Page (full-screen overlay)
   - Header: Cancel (X) | Timer | Trophy + sets counter
   - Progress bar
   - Volume display
   ↓
3. For each exercise:
   3a. Exercise Card:
     - Image/GIF toggle
     - Exercise name + equipment + target
     - "Warmup" button (if weight > 0, shows RAMP protocol)
     - "Plates" button (if barbell, shows plate breakdown)
     - "Skip" button (opens reason modal)
     - "Captain's Tip" expandable
     - "Add Notes" expandable
   3b. Set Rows:
     - Weight input (with ghost/previous value)
     - Reps input (with ghost/previous value)
     - RPE input (color-coded: green/yellow/orange/red)
     - Complete checkbox
     - Delete button
   3c. "Add Set" button
   ↓
4. Complete a set:
   - Check the ✓ button
   - Smart Rest Timer appears (auto-suggested by role × goal × RPE)
   - Timer shows: reason text + countdown + 4 preset buttons
   - Voice Coach: "Nice work, set complete."
   - At 15s left: Voice Coach: "15 seconds left!"
   - At 0s: Voice Coach: "Rest complete! Let's go!"
   ↓
5. New PR detected:
   - PRCelebration modal (confetti + trophy + weight + previous PR)
   - Voice Coach: "New personal record! Amazing!"
   - Push notification sent
   - Haptic pattern [30,40,30,40,60]
   ↓
6. Halfway mark (50% sets completed):
   - Voice Coach: "Halfway there! Keep pushing!"
   ↓
7. Finish Workout:
   - Click "Finish Workout" button
   - Confirmation modal
   - Confetti (neon colors)
   - Voice Coach: "Workout complete! Amazing session!"
   - Share Card appears (date, duration, volume, exercises, sets, streak)
   - "Share to Feed" toggle
   ↓
8. Home Page (returned)
   - Stats updated (streak, workouts, volume)
   - Recent Activity shows new workout
   - Recovery Heatmap updated (trained muscles now "Just Trained")
```

### Flow 4: Stats & Analytics

```
1. Bottom Nav → Click "Stats"
   ↓
2. Stats Page:
   - Hero Streak Card (flame + streak number + 7-day mini heatmap)
   - Quick Stats (Workouts/Volume/Time)
   - Weekly Volume Bar Chart (8 weeks, gradient bars)
   - Muscle Volume Map (interactive AnatomyMap with volume heatmap)
     * Imbalance warning badge if any muscle < 30%
     * Front/Back toggle
     * Volume breakdown bars per muscle group
   - Exercise Progress Chart (dropdown selector + line chart with 1RM + max weight)
   - Personal Records (top 5 with trophy + 1RM badge)
   - Calendar Heatmap (12 weeks × 7 days, GitHub-style)
```

### Flow 5: Social Feed

```
1. Bottom Nav → Click "Feed"
   ↓
2. Feed Page:
   - "FEED" header + "See what your friends are lifting"
   - Tab buttons (Feed / Challenges)
   - Search bar (find athletes)
   - Following horizontal scroll (with "Find" button)
   - Share prompt ("Share your latest workout?")
   - Feed Posts:
     * Author avatar + name + time-ago
     * Delete button (author only)
     * Workout summary (duration/exercises/volume)
     * Kudos button (heart pulse animation)
     * Comments button (opens CommentsSheet)
   ↓
3. Click "Challenges" tab
   - List of active challenges
   - Join button
   - Leaderboard
```

### Flow 6: Profile Management

```
1. Bottom Nav → Click "Profile"
   ↓
2. Profile Page:
   - Hero Profile Card:
     * Avatar (tap to upload → camera/gallery/remove)
     * Name (from onboarding)
     * Email
     * "X Completed Workouts" badge
     * Mini achievement icons (5)
     * Sync Now / Logout buttons
   - Stats Grid (2×2):
     * Workouts (primary)
     * Streak (warning) + Freeze button
     * Weight (secondary) + trend indicator
     * Volume (primary)
   - Personal Records (top 3)
   - Achievements (4 badges with progress bars)
   - Menu Items (Body Metrics / Progress Photos / Settings)
   ↓
3. Tap Avatar → AvatarUploadSheet
   - Take Photo / Choose from Gallery / Remove Photo
   ↓
4. Tap Settings → Settings Page
   - Theme / Ramadan / Rest / Unit / Notifications / Sound / Voice Coach / Cloud / Backup
```

### Flow 7: Nutrition Tracking

```
1. Bottom Nav → Click "Nutrition"
   ↓
2. Nutrition Page:
   - Calorie Ring (consumed vs goal, color changes at threshold)
   - Macro Cards (Protein lime / Carbs cyan / Fat gold)
   - Meals List:
     * Breakfast (Sun icon) → Add Food modal
     * Lunch (Utensils icon) → Add Food modal
     * Dinner (Moon icon) → Add Food modal
     * Snack (Coffee icon) → Add Food modal
   - Water Tracker (8 droplets)
   - Quick Add FAB
   ↓
3. Add Food Modal:
   - Name, Calories, Protein, Carbs, Fat, Meal Type
   - Submit → entry added
   ↓
4. Edit Goals (tap settings icon on ring):
   - Manual entry or BMR Calculator
   - Calculator: weight/height/age/gender/activity/goal → calculated macros
```

### Flow 8: Routine Builder

```
1. Home → Click "Create Routine"
   ↓
2. Builder Page:
   - Name input
   - Photo upload (from gallery)
   - Exercise selection:
     * AnatomyMap filter (tap muscles to filter exercises)
     * Exercise list (filtered by selected muscles)
     * Add exercises to routine
   - Sets/Reps/Rest per exercise
   - Save routine
   ↓
3. Routine appears in Home → My Routines
```

---

## ⚠️ Known Issues (from Code Review V3)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | deletePost API route missing (404) | P0 | Broken |
| 2 | All guests share same UID | P0 | Bug |
| 3 | Water tracker non-functional (no onClick) | P0 | Incomplete |
| 4 | BodyPage leaks object URLs | P0 | Memory leak |
| 5 | Notification icon path 404 | P0 | Regression |
| 6 | Commitment duration buttons are no-op | P1 | Incomplete |
| 7 | Following horizontal scroll missing user avatars | P1 | Incomplete |
| 8 | Kudos only increments (no toggle) | P1 | Bug |
| 9 | Profile shows only 4 of 15 achievements | P1 | Incomplete |
| 10 | No edit profile (name/email) | P1 | Missing |
| 11 | Resume workout after refresh not supported | P1 | Missing |
| 12 | Builder page lacks name/photo/anatomy filter | P1 | Incomplete |

---

## 📊 Summary Statistics

| Metric | Count |
|--------|-------|
| **Total Epics** | 13 |
| **Total User Stories** | 75 |
| **User Flows documented** | 8 |
| **Critical bugs (P0)** | 8 |
| **High priority (P1)** | 24 |
| **Medium (P2)** | 25 |
| **UX issues** | 24 |
| **Incomplete features** | 16 |
| **Total findings** | 97 |

---

## 🆕 V2 Updates (Based on AI Feedback)

### New Epics Added:

### Epic 14: Account Management & Privacy

**US 14.1 — Guest Data Migration**
> As a guest user, when I decide to create a permanent account, I want my workout history, PRs, and settings to transfer to the new account, so that I don't lose any progress.

**US 14.2 — Delete Account**
> As a user, I want to delete my account and all associated data, so that I can exercise my right to erasure (GDPR/CCPA compliance).

**US 14.3 — Change Password**
> As a user, I want to change my password, so that I can maintain account security.

**US 14.4 — Password Recovery**
> As a user who forgot my password, I want a "Forgot Password" flow to reset it, so that I can regain access to my account.

**US 14.5 — Edit Profile**
> As a user, I want to edit my name, email, and display name post-onboarding, so that I can keep my profile up to date.

---

### Epic 15: Social Safety & Moderation

**US 15.1 — Report Post**
> As a user, I want to report an offensive or inappropriate feed post, so that moderators can review and remove it. *(Required for App Store approval)*

**US 15.2 — Report Comment**
> As a user, I want to report an offensive comment, so that moderators can review it.

**US 15.3 — Block User**
> As a user, I want to block another user, so that their posts no longer appear in my feed and they cannot comment on my posts.

**US 15.4 — Content Guidelines**
> As a user, I want to see community guidelines before posting, so that I understand what content is acceptable.

---

### Epic 16: Offline Mode & Resilience

**US 16.1 — Offline Workout Logging**
> As a user in a gym with poor WiFi, I want to start and log a workout with no internet, so that I'm not blocked by network issues.

**US 16.2 — Background Sync**
> As a user, when my connection returns after an offline workout, I want the app to automatically sync my data to the cloud, so that nothing is lost.

**US 16.3 — Auto-Save Workout**
> As a user, if the app crashes or I accidentally close it mid-workout, I want my progress to be auto-saved, so that I can resume from where I left off.

**US 16.4 — Resume Workout**
> As a user, when I reopen the app after an interruption, I want to see a "Resume Workout" prompt, so that I can continue my session.

**US 16.5 — AI Error State**
> As a user, if the AI Coach fails to generate a workout (network error/API failure), I want to see a clear error message with a Retry button, so that I can try again instead of being stuck.

---

### Epic 17: Program Customization

**US 17.1 — Swap Exercise**
> As a user reviewing my AI-generated program, I want to swap any exercise for an alternative (same muscle group), so that I can customize the plan to my preferences.

**US 17.2 — Edit Sets/Reps**
> As a user, I want to edit the sets, reps, and rest for any exercise in my program before starting, so that I can fine-tune the difficulty.

**US 17.3 — Reorder Exercises**
> As a user, I want to drag-and-drop exercises to reorder them, so that I can control my workout flow.

**US 17.4 — Remove Exercise**
> As a user, I want to remove an exercise from my program, so that I can shorten the workout if needed.

---

### Epic 18: Food Database (Phase 2)

**US 18.1 — Search Food Database**
> As a user logging meals, I want to search a food database by name, so that I don't have to manually enter macros for common foods.

**US 18.2 — Barcode Scanner**
> As a user, I want to scan a food barcode, so that nutritional info is auto-filled.

**US 18.3 — Save Custom Foods**
> As a user, I want to save frequently eaten foods as "favorites", so that logging is faster.

---

## 🔄 Updated User Flows

### Flow 1 (UPDATED): First-Time User

```
1. Open app
   ↓
2. Splash Screen (2.5s)
   ↓
3. Onboarding Carousel (6 screens)
   3a. "AI-Powered Workouts" → Continue
   3b. "Track Every PR" → Continue
   3c. "2M+ Sets Tracked" (social proof) → Continue
   3d. "Join 50,000+ Athletes" (community) → Continue
   3e. "What's your name?" → Enter name → Continue
   3f. "Tell us your stats" (NEW) → Weight, Height, Goal → Continue
   ↓
4. Auth Page (NO notification permission request here)
   - Login / Create Account / Continue as Guest
   ↓
5. Home Page (logged in)
   - Personalized greeting with name
   - Stats pre-filled from onboarding (weight, goal)
   ↓
... (user explores, generates workout, starts training)
   ↓
6. AFTER first workout completion (NEW timing):
   - "Great job! Want to get PR alerts and workout reminders?"
   - → Request notification permission
   - User is most likely to accept after experiencing value
```

### Flow 3 (UPDATED): Active Workout — with Auto-Save & Resume

```
1. Start workout from Result View
   ↓
2. Workout Session Page
   - Auto-save: every set completion saves to sessionStorage
   ↓
3. If app crashes / user closes:
   - Workout state is in sessionStorage (activeWorkout + completed sets)
   ↓
4. User reopens app:
   - App checks: "Is there an unfinished workout in sessionStorage?"
   - If YES: Show "Resume Workout" modal
     "You have an unfinished workout (X/Y sets completed). Resume?"
     [Resume] [Discard]
   - Resume → restores full workout state
   - Discard → clears sessionStorage, returns to home
   ↓
5. AI Error State (if generation fails):
   - Error message: "Couldn't generate workout. Check your connection."
   - [Retry] button → re-attempts AI Coach
   - [Use Standard Generator] → falls back to heuristic
```

### Flow 9 (UPDATED): Guest → Account Migration

```
1. Guest user has been using the app (data in local IndexedDB)
   ↓
2. User decides to create an account (Profile → "Create Account")
   ↓
3. Migration Flow:
   - Detect: "You have X workouts, Y PRs as a guest. Create an account to keep them safe!"
   - User enters email + password
   - System creates new account with new UID
   - All local IndexedDB data (sessions, PRs, measurements, photos) is re-linked to new UID
   - Social profile created with new UID
   - Guest data is preserved — nothing is lost
```

---

## 📊 Updated Summary Statistics

| Metric | V1 | V2 |
|--------|----|----|
| **Total Epics** | 13 | 18 (+5) |
| **Total User Stories** | 75 | 95 (+20) |
| **User Flows** | 8 | 8 (3 updated) |
| **Critical bugs (P0)** | 8 | 3 fixed ✅ |
| **High priority (P1)** | 24 | pending |
| **Incomplete features** | 16 | 12 (4 addressed) |

## ✅ P0 Fixes Completed in V2

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| 1 | Guest UID collision | Unique device ID per browser (localStorage `pulse_device_id`) | ✅ Fixed |
| 2 | Water tracker non-functional | Added `waterGlasses` state + `handleWaterToggle` + localStorage persistence per day | ✅ Fixed |
| 3 | BodyPage memory leak | Cleanup function properly returned from `useEffect` | ✅ Fixed |
| 4 | deletePost API missing | Created `/api/social/posts/route.ts` with DELETE handler (ownership-scoped) | ✅ Fixed |
| 5 | Notification icon 404 | Copied `pwa-192x192.png` → `icons/icon-192.png` | ✅ Fixed |
| 6 | Notification permission too early | Moved from onboarding to after first workout completion | ✅ Fixed |

## 📋 Remaining P1 Issues (for next sprint)

| # | Issue | Priority |
|---|-------|----------|
| 1 | Commitment duration buttons are no-op | P1 |
| 2 | Following horizontal scroll missing user avatars | P1 |
| 3 | Kudos only increments (no toggle/decrement) | P1 |
| 4 | Profile shows only 4 of 15 achievements | P1 |
| 5 | No edit profile (name/email) | P1 |
| 6 | Resume workout after refresh not supported | P1 |
| 7 | Builder page lacks name/photo/anatomy filter | P1 |
| 8 | AI error state (no Retry button on failure) | P1 |
