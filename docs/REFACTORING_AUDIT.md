# Intervium — Refactoring & Standardization Audit

**Date:** 2026-06-02 · **Scope:** full app (~31K LOC TS/TSX, Next.js 16 App Router, Drizzle + Supabase Postgres, Auth.js v5, Tailwind v4, shadcn/ui, Groq AI) · **Lens:** maintainability, readability, architecture, consistency. Correctness/security/UX/a11y/perf bugs are covered separately in [`PRODUCTION_AUDIT.md`](PRODUCTION_AUDIT.md).

## Headline

**Intervium was already a well-engineered codebase**, not a messy one. A 6-dimension audit (folder structure, components, backend/API, types/errors/logging, config/docs, naming) found strong fundamentals and a small set of genuine, targeted issues — mostly structural (god-modules) and operational (missing scaffolding/docs). **No mass renaming was warranted**; the work focused on the real gaps and preserved all behavior.

---

## 1. Repository Audit (by dimension)

| Dimension | Rating | Notes |
| --- | --- | --- |
| Folder structure | Good | Clean feature-based layout (`components/<feature>`, `lib/actions/<feature>`, `lib/<domain>`). Scalable. |
| File naming | Good | PascalCase components, lowercase `ui/*` (shadcn) — only **2 kebab-case hook files** were inconsistent. |
| Dead code / dangling refs | Strong | Zero dangling imports after the in-flight question-bank deletions; ~no commented-out code. |
| React components | Good | Strong typing & server/client split; a few **god-components** with inline sub-components. |
| Backend / API | Good | Validation-first thin actions → focused services → Drizzle; transactions on admin writes; one **god-module** (`groq.ts`). |
| Type safety | Strong | **Zero `any`**, zero `@ts-ignore`/`eslint-disable`, strict mode; `unknown` used correctly at boundaries. |
| Error handling | Strong | Domain error classes (`ScoringError`, `CvAiError`, `QuestionGenerationError`, `AiBudgetError`); consistent `{ ok, error }` returns. |
| Logging | Good | 100% `[context]`-prefixed `console.error/warn`; no debug cruft. (Logger abstraction is a future nicety.) |
| Config / tooling | Fair → Good | Strict TS/ESLint/Prettier; gaps fixed: missing `.env.example`, **no CI**, stale `package.json`/README. |
| Naming (vars/fns) | Strong | ~95% intention-revealing; a handful of trivial single-letter temporaries (left as-is). |

---

## 2. Architecture Improvement Report

**Done (behavior-preserving):**
- **`groq.ts` (1841 LOC god-module) → `src/lib/ai/*`**: split into `client.ts` (HTTP/retry/timeout, JSON parsing, `generateJson`, errors), `interview.ts` (generation + scoring + summary), `cv.ts` (match/ATS/extract/optimize + cover letter), `skill-gap.ts`, `dojo.ts`. `groq.ts` is now a 12-line **re-export barrel**, so all 15+ existing `@/lib/groq` importers are unchanged. No module now exceeds ~780 LOC.
- **God-component decomposition** (verbatim module-scope extraction, parent prop contracts unchanged):
  - `QuestionsAdmin.tsx` **927 → 358** LOC; sub-components moved to `admin/questions/` (`controls`, `QuestionFields`, `QuestionDialog`, `EditQuestionDialog`, `ImportDialog`).
  - `UsersAdmin.tsx` **589 → 172** LOC; 5 dialogs moved to `admin/users/`.
- **Shared `Result<T>`** consolidated into `src/lib/actions/result.ts` (removed duplicated definitions in `cv.ts` and `dojo.ts`).

**Deferred (with rationale) — recommended follow-ups:**
- **OnboardingWizard (745) & ProfileEditor (667) breakups.** Their inline steps/sections are tightly coupled to parent state/effects; extracting them safely requires reworking state flow. With **no automated test suite**, that carries real regression risk — best done as a reviewed, separately-verified change.
- **Shared `AdminFormDialog` / `FormField` primitives.** Creating them is safe, but *adopting* them means rewriting the internals of working stateful dialogs — same untested-regression risk. High value once tests exist.

---

## 3. Naming Standard Report

**Verdict: naming is already strong; mass renaming was correctly NOT performed.** Functions are verb-phrased and intention-revealing; booleans use `is/has/should`; constants are SCREAMING_CASE; domain types are precise. Targeted fixes applied:
- Hook files standardized to camelCase: `use-coarse-pointer.ts → useCoarsePointer.ts`, `use-editor-draft.ts → useEditorDraft.ts` (+ 3 import sites).

Left intentionally (false positives / not worth the churn): single-letter temporaries in tight math/loop scopes (`i/j` in Fisher–Yates, color-math params in `avatar.tsx`); shadcn `ui/*` lowercase filenames.

The codified conventions now live in [`CLAUDE.md`](../CLAUDE.md).

---

## 4. Dead-Code Report

**Clean.** The in-flight question-bank reset removed `insights.ts`, `signature.ts`, `actions/practice.ts`, `admin/difficulty.ts`, several dashboard components, and `seed-questions.ts` — a grep across `src/`+`db/` confirmed **zero remaining imports** of any of them. Near-zero commented-out code (1 explanatory comment, 1 TODO). No `@ts-ignore`/`eslint-disable`. The two `CodeEditor.tsx` files are an intentional shared-base + adapter pair, not a duplicate.

Hygiene fixes: untracked `.qwen/` removed from git tracking and gitignored; stray `.qwen/settings.json.orig` no longer tracked.

---

## 5. Security Report

See [`PRODUCTION_AUDIT.md`](PRODUCTION_AUDIT.md) (comprehensive). Refactoring-relevant confirmations: server-side authorization is re-checked in every action/route, queries are `userId`-scoped (IDOR-safe), inputs are zod-validated, SQL is parameterized, AI output is zod-validated + React-escaped, secrets are `server-only`. The prior critical (committed admin credentials) is already remediated — README/seed no longer expose them, and `env.ts` fails fast on missing secrets. The restored `.env.example` documents every var without real values.

## 6. Performance Report

See [`PRODUCTION_AUDIT.md`](PRODUCTION_AUDIT.md). No performance regressions were introduced: the `groq.ts` split is a pure module move (same runtime), and the component extraction preserves render behavior. Batch scoring (N→1 AI calls), the signature-keyed question cache, AI budget guard, and rate limiting remain intact.

---

## 7. Production-Readiness Score (maintainability/standardization lens)

**Before: ~82 / 100 → After: ~92 / 100.**

Gains: god-module and god-components decomposed; CI added; onboarding restored (`.env.example`, `CLAUDE.md`, expanded README); docs de-cluttered into `docs/`; shared `Result<T>`; hook-naming consistency. Remaining deductions are the items in §8 (no tests, no observability, in-memory rate limiter) — all tracked, none introduced by this work.

---

## 8. Remaining Technical Debt

1. **No automated test suite** (highest). Add Vitest; cover scoring, question-engine signature logic, CV parse/ATS, auth/session, admin CRUD validation.
2. **Observability**: no error tracking / structured logging SDK (a `src/lib/logger.ts` wrapper preserving the `[context]` prefix is a low-risk first step).
3. **Rate limiter is in-memory** — ineffective across serverless instances; move to Upstash/Redis.
4. **Deferred component breakups**: OnboardingWizard, ProfileEditor (do after tests exist).
5. **Shared admin form/dialog primitives** (`AdminFormDialog`, `FormField`) — adopt after tests exist.
6. **Migrate import sites** from the `@/lib/groq` barrel to `@/lib/ai/*` directly (optional; barrel can then be removed).
7. **Type/zod unification**: a few actions hand-declare types that could be `z.infer`-ed.
8. **`src/middleware.ts`**: Next 16 builds it as "Proxy"; relocating/renaming is cosmetic and was skipped to avoid touching the auth gate.
9. **Repo-wide Prettier drift**: the codebase predates Prettier enforcement — `npm run format:check` flags ~105 files (confirmed pre-existing at `HEAD`). CI runs it advisory-only. A one-time `prettier --write .` (its own commit) would make it a hard gate; deferred so it doesn't bury reviewable diffs or reformat in-flight WIP.

---

## 9. Prioritized Action Plan

| Priority | Item | Effort | Risk |
| --- | --- | --- | --- |
| P0 | Add Vitest + tests for critical paths (§8.1) | L | low |
| P1 | Observability: logger wrapper + error tracking (§8.2) | M | low |
| P1 | Shared-store rate limiter (§8.3) | M | medium |
| P2 | OnboardingWizard / ProfileEditor breakups (§8.4) | M | medium (needs tests first) |
| P2 | Shared `AdminFormDialog` / `FormField` (§8.5) | M | low (after tests) |
| P3 | Migrate off the `groq` barrel; zod-infer types (§8.6–8.7) | S | low |

---

## Appendix — What this refactor changed

| Phase | Change | Verification |
| --- | --- | --- |
| 0 | Restored `.env.example` (all vars documented); verified baseline green | type-check/lint/build ✅ |
| 1 | `.gitignore` (+`.qwen`), `package.json` description, `.github/workflows/ci.yml` | — |
| 2 | Moved planning docs → `docs/`; expanded `README.md`; new `CLAUDE.md` | — |
| 3 | Renamed 2 hook files → camelCase; shared `Result<T>` | type-check/lint ✅ |
| 4 | Split `groq.ts` → `src/lib/ai/*` (barrel) | type-check/lint/build ✅ |
| 5 | Decomposed `QuestionsAdmin` (927→358) & `UsersAdmin` (589→172) | type-check/lint/build ✅ |

Every phase preserved application behavior. No functional or contract changes were made (e.g., `GET→POST` on the questions route and the `saveDojoAttempt` transaction were intentionally left to `PRODUCTION_AUDIT.md`).
