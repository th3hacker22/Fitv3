# Pulse Fitness — Continuation Prompt

## Copy-paste this prompt into the new conversation:

---

أنا أعمل على مشروع Pulse Fitness (تطبيق لياقة بدنية) مبني بـ Next.js 16. المشروع موجود على GitHub: https://github.com/th3hacker22/Fitv3.git

تم تنفيذ التحسينات التالية بالفعل:

### ✅ مكتمل — CODE_REVIEW.md (كل المراحل 1-6):
- Phase 1: Critical fixes (auth race, theme flash, inner components, sync-volume, comments IDOR)
- Phase 2: Security hardening (rate limiting, auth headers, validation, impersonation prevention, transactions)
- Phase 3: React performance (individual Zustand selectors, StatsPage effect deps, router history cap, syncAll guard)
- Phase 4: Accessibility WCAG AA (aria-labels, aria-expanded, aria-current, role=alert, list semantics, prefers-reduced-motion)
- Phase 5: Code quality (dead code removal, try/catch, importLocalBackup, Prisma shutdown)
- Phase 6: Testing (138 tests across 14 files)

### ✅ مكتمل — DESIGN_IMPROVEMENT_PLAN.md (كل الأولويات P0-P2):
- P0: Home, Nutrition, AI Wizard, Workout Session, Layout (padding, text sizes, touch targets)
- P1: Exercises, Feed, Stats, Profile, Body Metrics, Challenges (font hierarchy, spacing, contrast)
- P2: Settings + Button component + SetRow + ShareCard + AnatomyMap (toggles 48px, icon containers 48px)
- شامل: كل text-[8/9/10/11px] → text-xs (12px), كل text-text-muted → text-text-secondary, hardcoded rgba → CSS variables

### ✅ مكتمل — AI_GENERATOR_PLAN.md:
- تقليل 14 خطوة → 5 خطوات
- Age stepper ±1
- Smart defaults حسب الهدف
- Multi-provider AI router (z-ai-sdk + Groq + Gemini + OpenRouter)
- AI Coach endpoint يقرأ بيانات المستخدم الكاملة (تاريخ التمارين، الأرقام القياسية، التحليلات)

### 📋 المتبقي — اقرأ هذه الملفات للمتابعة:

1. **`DESIGN_IMPROVEMENT_PLAN.md`** — خطة تصميم الواجهات (295 سطر). P0 و P1 و P2 مكتملة، لكن راجع "Success Metrics" في النهاية للتأكد.
2. **`CODE_REVIEW.md`** — مراجعة الكود الكاملة (114 finding). كل CRITICAL + HIGH + معظم MEDIUM معالجة. راجع "Decision Points for User" في النهاية.
3. **`AI_GENERATOR_PLAN.md`** — خطة الـ AI Generator. الخطوات 1-4 (تقليل الخطوات + stepper + smart defaults) مكتملة. المتبقي:
   - Progressive overload tracking في workoutGenerator.ts
   - Fatigue management system
   - Exercise pairing optimization (supersets)
   - Learning loop (track skips/modifications)
4. **`UI_UX_IMPROVEMENT_PLAN.md`** — خطة UI/UX أخرى (312 سطر). تحقق من Success Metrics.

### 🔧 المعلومات التقنية:
- المشروع: Next.js 16 + TypeScript + Tailwind v4 + Prisma/SQLite + Dexie/IndexedDB
- المسار الوحيد المرئي: `/` (src/app/page.tsx) مع client-side router
- الاختبارات: `bun run test` (138 اختبار)
- خادم التطوير: `bun run dev` (المنفذ 3000)
- قاعدة البيانات: `bun run db:push` (Prisma schema في prisma/schema.prisma)
- ملفات الخطة موجودة في جذر المشروع: `CODE_REVYGIEW.md`, `DESIGN_IMPROVEMENT_PLAN.md`, `AI_GENERATOR_PLAN.md`, `UI_UX_IMPROVEMENT_PLAN.md`

### 🎯 ما أريد متابعته:
1. راجع كل ملفات الخطة وحدد ما تبقى
2. أكمل أي تحسينات متبقية من DESIGN_IMPROVEMENT_PLAN.md (Success Metrics)
3. نفذ Progressive Overload + Fatigue Management من AI_GENERATOR_PLAN.md
4. راجع Decision Points من CODE_REVIEW.md (استراتيجية المصادقة، next/image، PWA)
5. استخدم المهارات المتاحة (skills folder) حسب الحاجة

---

## ملفات الخطة موجودة في:
- `/home/z/my-project/CODE_REVIEW.md`
- `/home/z/my-project/DESIGN_IMPROVEMENT_PLAN.md`
- `/home/z/my-project/AI_GENERATOR_PLAN.md`
- `/home/z/my-project/UI_UX_IMPROVEMENT_PLAN.md`

## للتحقق من الحالة الحالية:
```bash
cd /home/z/my-project
bun run test  # 138 اختبار
bun run dev   # خادم التطوير
tail -20 dev.log  # سجل الخادم
```
