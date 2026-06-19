# Workspace Rules & Core Skills Instructions

> **Note:** For repo-level developer instructions (commands, architecture, DB, auth), see [AGENTS.md](../AGENTS.md) in the project root.

You are instructed by the user to treat specific skills from the workspace `skills` directory as your core/primary skills. You must refer to them, consult their guidelines, and state clearly at the very beginning of your response which of these skills you will use for the task.

## Response Formatting Rule
At the beginning of every response, you MUST output a section stating which of the primary skills (1, 2, 3, or 4) and their specific sub-skills you will use to address the user's request.
Example format in Arabic:
> سنستخدم المهارة [الرقم والاسم] لعمل [تفاصيل العمل]...

## Core Primary Skills Mapping

### 1. مهارات هندسة البرمجيات المتقدمة (Senior Engineering)
- **TDD Workflows (التطوير الموجه بالاختبار)**:
  - Skill name: `tdd-workflows-tdd-cycle`
  - Path: [SKILL.md](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/skills/antigravity-awesome-skills-main/skills/tdd-workflows-tdd-cycle/SKILL.md)
  - Rule: Write tests first before any code implementation. Enforce strict red-green-refactor discipline.
- **Clean Architecture & Code**:
  - Skill name: `clean-code`
  - Path: [SKILL.md](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/skills/antigravity-awesome-skills-main/skills/clean-code/SKILL.md)
  - Rule: Follow Robert C. Martin's clean code principles. Keep functions small, single-purpose, clean naming, no spaghetti code.
- **Framework Experts**:
  - Skill names: `nextjs-best-practices`, `nextjs-app-router-patterns`, `fastapi-pro`, `django-pro`, `react` (or relevant framework skills in the workspace).
  - Rule: Follow official, latest best practices and documentation rather than hallucinating outdated patterns.

### 2. مهارات الأمان والاختراق (Security & Auditing)
- **OWASP Top 10 Checks**:
  - Skill names: `web-security-testing` (OWASP checks) or `007` (comprehensive security auditing).
  - Path: [web-security-testing/SKILL.md](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/skills/antigravity-awesome-skills-main/skills/web-security-testing/SKILL.md) or [007/SKILL.md](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/skills/antigravity-awesome-skills-main/skills/007/SKILL.md)
  - Rule: Always review code for common vulnerabilities (injection, XSS, authentication, access control) before completing changes.
- **Container Security Hardening**:
  - Skill name: `container-security-hardening`
  - Path: [SKILL.md](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/skills/antigravity-awesome-skills-main/skills/container-security-hardening/SKILL.md)
  - Rule: Protect Docker files, detect container vulnerabilities, run as non-root, and optimize base images.
- **Ethical Hacking**:
  - Skill name: `ethical-hacking-methodology`
  - Path: [SKILL.md](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/skills/antigravity-awesome-skills-main/skills/ethical-hacking-methodology/SKILL.md)
  - Rule: Act as a penetration tester to audit and check API and system endpoints.

### 3. مهارات العمليات والأتمتة (DevOps & CI/CD)
- **GitHub Actions Advanced**:
  - Skill name: `github-actions-advanced`
  - Path: [SKILL.md](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/skills/antigravity-awesome-skills-main/skills/github-actions-advanced/SKILL.md)
  - Rule: Write professional, secure CI/CD pipelines, automate deployments, and debug workflow errors.

### 4. وضع الاستقلالية الكاملة (Autonomous / Orchestration Mode)
- **Loki Mode (Autonomous Mode)**:
  - Skill name: `loki-mode`
  - Path: [SKILL.md](file:///d:/Mohamed/AntiGravity/fitv6/Fitv3-main/skills/antigravity-awesome-skills-main/skills/loki-mode/SKILL.md)
  - Rule: For large tasks, act as a Project Manager: analyze requirements (PRD), plan and subdivide tasks, write frontend/backend/database code, and verify in a loop until completion.
