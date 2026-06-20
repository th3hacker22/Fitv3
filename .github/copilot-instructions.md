# Pulse Fitness — Copilot Instructions

## Spec-Driven Development
This project uses GitHub Spec Kit for spec-driven development. Always check:
1. `.specify/constitution.md` — governing principles and tech stack rules
2. `.specify/specs/` — feature specifications
3. `.specify/plans/` — implementation plans
4. `.specify/tasks/` — task breakdowns

## Commands
- `/speckit.constitution` — View/edit constitution
- `/speckit.specify` — Create a new spec
- `/speckit.plan` — Create implementation plan
- `/speckit.tasks` — Break down into tasks
- `/speckit.implement` — Implement from tasks

## Key Rules (NON-NEGOTIABLE)
1. NEVER use `any` type — use `unknown` with type guards
2. NEVER set `ignoreBuildErrors: true`
3. NEVER use `prisma db push` — use `prisma migrate dev`
4. NEVER trust client-supplied identity headers
5. ALWAYS use `cmd /c` prefix for Windows commands
6. ALWAYS run `bun run lint` before committing
7. ALWAYS verify Firebase Admin SDK before calling `requireUser`
