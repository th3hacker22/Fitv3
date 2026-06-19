# Pulse Fitness - Comprehensive 0 to Z Code Audit (V4)

This document presents a comprehensive code audit of the **Pulse Fitness** application codebase, covering regression checks, state management, database & API integrity, performance, security, and accessibility (a11y).

---

## Summary of Findings

| Severity | Count | Key Areas Impacted |
| :--- | :---: | :--- |
| 🔴 **Critical** | 2 | Authentication/Impersonation, LLM Prompt Injection & Cost Exploit |
| 🟠 **High** | 2 | Challenge Volume Double-Counting, Performance Degradation in Achievements |
| 🟡 **Medium** | 3 | Indexing Limitation on Booleans, Lack of Zod Validation, CSS Conflict Risk |
| 🔵 **Low** | 2 | Unused Dependencies, a11y Missing Labels |

---

## 🔴 Critical (Will break production / High Security Risk)

### 1. Header-Based Identity Spoofing & Lacking Server-Side Authentication
* **Location:** `src/middleware.ts`, `src/app/api/social/*`, `src/app/api/challenges/*`
* **Vulnerability Type:** Broken Authentication / Identity Spoofing (OWASP A01:2021)
* **Description:** 
  The backend utilizes a header-based authentication mock scheme (`x-user-uid` / `x-user-name`). 
  * In [middleware.ts](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/src/middleware.ts#L136-L148), the server simply asserts that `x-user-uid` is present and non-empty for write operations (`POST`, `DELETE`, etc.).
  * Inside endpoint files like [comments/route.ts](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/src/app/api/social/comments/route.ts#L19-L25), identity is directly extracted from the header without cryptographic verification (such as a JWT, NextAuth Session Cookie, or Firebase Auth token).
  * This allows any client (e.g., using Postman, curl, or custom scripts) to inject arbitrary `x-user-uid` headers, thereby editing/deleting comments, following/unfollowing users, or posting workouts as anyone else (IDOR).
* **Impact:** High probability of account takeover, social spamming, and data corruption in a shared production DB.

### 2. Client-Controlled System Instructions in AI Generation (Prompt Injection & Cost Exploit)
* **Location:** [ai-workout/route.ts](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/src/app/api/ai-workout/route.ts#L13-L25)
* **Vulnerability Type:** Prompt Injection / Resource Abuse (OWASP LLM01 / LLM04)
* **Description:** 
  The `/api/ai-workout` POST route accepts `systemInstruction` and `prompt` directly from the request body and forwards them unfiltered to `ZAI.create().chat.completions.create`.
  * Because the client defines the system instruction, any user can bypass the application bounds entirely by feeding customized instructions (e.g., instructing the model to behave as a translation assistant, run heavy computation tests, or generate unrelated content).
  * The SDK calls are made on the server side using the server's API key.
* **Impact:** Attackers can hijack the LLM backend for free personal use, leading to rapid API quota exhaustion and massive server bill inflation (Denial of Wallet).

---

## 🟠 High (Severe UX/Logic issues)

### 1. Challenge Volume Double-Counting & Lack of Server-Side Idempotency
* **Location:** [useChallengesStore.ts](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/src/store/useChallengesStore.ts#L132-L177), [sync-volume/route.ts](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/src/app/api/challenges/sync-volume/route.ts#L16-L30)
* **Vulnerability Type:** Integrity Flaw / Race Condition
* **Description:**
  * To prevent double-counting of workout volume during synchronization, the client uses a module-scoped `syncedSessionIds` Set.
  * However, this set is stored purely in client-side memory. If the user refreshes the page or reopens the app, the set is cleared.
  * Crucially, the server-side route `/api/challenges/sync-volume` does **not** store completed session IDs or track idempotency keys. Any repeated POST request containing a previously-synced volume will successfully increment the participant's `progressKg` again.
* **Impact:** Users can inflate their challenge progress intentionally (by resending requests) or accidentally (due to offline synchronization retries, page reloads, or background sync triggers), destroying challenge integrity.

### 2. Performance Degradation in Achievements Evaluation (Sequential Collection Scans)
* **Location:** [useAchievementsStore.ts](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/src/store/useAchievementsStore.ts#L33-L56), [achievements.ts](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/src/data/achievements.ts#L73-L98)
* **Vulnerability Type:** UI Thread Blocking / N+1 DB Queries
* **Description:**
  * When a user finishes a workout, `evaluateAchievements` is called, iterating through `ACHIEVEMENTS` and executing `ach.checkCriteria()` sequentially.
  * Several criteria (e.g., `night_owl`, `early_bird`, and `weekend_warrior`) execute a full collection query:
    `db.workoutSessions.filter((s) => s.completed === true).toArray()`
  * Because these queries run sequentially inside a loop, it issues multiple redundant database scans, reading and parsing the entire set of workout sessions into memory over and over.
* **Impact:** As the user logs more workouts (e.g., 100+ sessions), finishing a workout will trigger a massive performance spike, freezing the UI thread for several hundred milliseconds.

---

## 🟡 Medium (Polish & Optimization)

### 1. Boolean Filtering Limitation in IndexedDB (Dexie)
* **Location:** [analytics.ts](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/src/db/analytics.ts#L6-L15)
* **Vulnerability Type:** Performance Bottleneck
* **Description:**
  * `getCompletedSessions` explicitly avoids Dexie's `.where("completed").equals(true)` query due to IndexedDB's limitations with indexing boolean fields. It falls back to `.filter(...)` which performs a full-table collection scan.
  * As the local DB grows, every analytical calculation (streak, weekly volume, PRs, muscle breakdown) will perform slow, non-indexed scans.
* **Recommendation:** Store `completed` as a binary integer (`0` or `1`) or string (`"true"`/`"false"`) and index it, allowing indexed lookups instead of full table scans.

### 2. Missing Input Validation via Zod in AI & Social Routes
* **Location:** `/api/ai-workout`, `/api/social/comments`
* **Vulnerability Type:** Weak Data Validation
* **Description:**
  * Although `zod` is installed in `package.json`, API routes manually parse bodies and use lightweight custom validators from `src/lib/validation.ts`.
  * The `/api/ai-workout` route does not validate structure or length beyond a basic check for presence of fields.
* **Recommendation:** Standardize validations across all API endpoints using Zod schemas to ensure type-safety, correct formats, and proper constraints.

### 3. Missing CSS Conflict Resolution (No `tailwind-merge` in custom `cn_` wrapper)
* **Location:** [WorkoutSessionPage.tsx](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/src/pages/WorkoutSessionPage.tsx#L474-L476)
* **Vulnerability Type:** CSS Style Contradiction
* **Description:**
  * The `WorkoutSessionPage.tsx` defines a local `cn_` helper:
    `const cn_ = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");`
  * This joins classes but does **not** override conflicting classes (e.g., `py-4` combined with a dynamic `py-2` or conflicting background colors). This relies on CSS declaration order, which is unstable under Next.js code splitting.
* **Recommendation:** Import and use the global `cn` helper (usually utilizing `tailwind-merge`) instead of defining a naive joining function locally.

---

## 🔵 Low (Refactoring / Dead Code)

### 1. Unused NextAuth Dependency
* **Location:** `package.json`
* **Description:**
  * `"next-auth"` is declared as a project dependency but has no active imports or configuration files inside the `src` directory.
* **Impact:** Unnecessary bloating of `package.json` and potential confusion for developers maintaining the codebase.

### 2. Missing Accessibility (a11y) Labels
* **Location:** Form elements in `AuthPage.tsx`, list actions in `WorkoutSessionPage.tsx`.
* **Description:**
  * Custom checkbox elements (like "Share to Feed") lack explicit accessibility mappings beyond basic `htmlFor`. 
  * Several buttons lack screen-reader labels (`aria-label`) or descriptive roles, limiting accessibility for users utilizing assistive tech.
