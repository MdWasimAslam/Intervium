# CLAUDE.md — Onboarding guide for AI agents

This file orients an AI agent (or new engineer) working in Intervium. Read it
before making changes. For product/setup details see [`README.md`](README.md);
for known debt see [`docs/`](docs/README.md).

## Project Purpose

Intervium is an **AI-powered interview-practice and CV platform**. Candidates run
mock interviews (text or coding), get per-question AI scoring with feedback, and
work on their CV (ATS analysis, AI optimization, cover letters). It also has a
gap-analysis view, a "Code Dojo" coding gym, an admin panel for all content, and
an admin-only QA diagnostics dashboard.

## Architecture Overview

Next.js 16 App Router. The layering, top to bottom:

```
src/app/**            Pages (server components) + 3 api/ route handlers
src/lib/actions/**    Server actions ('use server'): validate (zod) → authorize → orchestrate
src/lib/**            Services / domain logic (scoring, question-engine, gap-analysis, dashboard…)
src/lib/ai/**         AI client (Groq/DeepSeek): HTTP, retry/timeout, prompt building, capability fns
db/ + @db             Drizzle ORM over Supabase Postgres (single node-postgres `pg` pool, used for both queries and transactions)
```

- **Auth:** Auth.js v5 (Credentials + JWT). `src/auth.ts` (full), `src/auth.config.ts`
  (edge-safe, no DB/bcrypt), `src/middleware.ts` (route protection at the edge).
- **AI:** `src/lib/ai/*` (split out of the former `groq.ts`, which remains a re-export
  barrel for back-compat). Guarded by `ai-budget.ts` (daily budget) and `rate-limit.ts`.

## Folder Structure

See [README → Folder Structure](README.md#folder-structure). In short: components
are grouped by feature under `src/components/<feature>/`; `src/components/ui/` holds
shadcn primitives; server actions mirror features under `src/lib/actions/`; cross-cutting
services are flat in `src/lib/`.

## Coding Standards

- **TypeScript strict, zero `any`.** Prefer `z.infer<typeof schema>` over hand-written
  duplicate interfaces. Use `unknown` (not `any`) at deserialization boundaries, then zod-parse.
- **Run the gate** before declaring done: `npm run type-check && npm run lint && npm run format:check && npm run build`.
- **No `console.log` debug cruft.** Error/warn logging uses a `[context]` prefix, e.g. `console.error("[saveAnswer]", error)`.
- Keep diffs behavior-preserving unless explicitly fixing a bug.

## Naming Conventions

- **Variables:** intention-revealing, domain-specific (`skillLevel`, `sessionQuestions`, `userAnswer`). Avoid single letters except idiomatic callback/loop indices.
- **Functions:** verb-phrased (`generateQuestions`, `scoreAnswersBatch`, `startInterview`). Booleans: `is/has/should`.
- **Components:** PascalCase files (`QuestionsAdmin.tsx`). **Hooks:** camelCase files (`useAnswerQueue.ts`).
- **Services / libs:** kebab- or camelCase `.ts` matching the dominant local style; `ui/*` shadcn files stay lowercase.
- **Server actions:** explicit verb + domain (`scoreSessionAction`, `getPrimaryCvAction`); admin actions return `AdminResult`.
- **API routes:** noun-based paths under `src/app/api/`.

## Do-Not-Break Rules (critical business logic)

1. **Authorization is per-request.** Every server action and API route must re-check
   `getCurrentUser()` / `requireAdmin()` and scope DB queries by `userId`. Never rely on
   middleware alone. Do not remove these guards.
2. **Validate before side effects.** Inputs are zod-validated before any DB/AI call.
3. **Scoring is idempotent and budget-aware.** `scoreSession` (`src/lib/scoring.ts`) skips
   already-scored work and reserves the AI budget *before* batch calls. On `AiBudgetError`
   the session stays unscored (retryable) — do not write fallback zeros that permanently finalize it.
4. **Question cache by signature.** The sha256 "signature" keys the shared question pool; changing
   how it's computed invalidates existing caches.
5. **Multi-table writes use `withTransaction`** (`db/tx.ts`) — see `admin/users.ts`. Don't split
   atomic writes into separate un-wrapped statements.
6. **Single live interview per user.** `startInterview` closes prior in-progress sessions
   (non-destructive). Preserve this invariant.
7. **AI output is zod-validated and React-escaped.** Never introduce `dangerouslySetInnerHTML`/`eval`
   on model output. Untrusted text (CV/JD/answers) goes into prompts as data, not instructions.

## Development Guidelines

- Add a feature → new server action (thin) + service function + (if needed) Drizzle migration via `npm run db:generate`.
- Reuse the shared `Result<T>` type and admin `AdminResult`/`zodError` helpers (`src/lib/actions/util.ts`).
- Reuse UI primitives in `src/components/ui/` and shared admin wrappers; don't hand-roll dialogs/fields.

## Testing Guidelines

No automated test framework yet (tracked debt). Until one lands, verify changes by running the
gate plus a manual smoke test of the affected flow (`npm run dev`). High-value future targets:
scoring, question-engine signature logic, CV parse/ATS, auth/session, admin CRUD validation.

## Deployment Notes

Vercel + Supabase Postgres. Set `DATABASE_URL` (the Supabase connection string), `AUTH_SECRET`,
`GROQ_API_KEY`, `NEXT_PUBLIC_SITE_URL`. Run `db:migrate` + `db:seed` against prod once. Migrations
are not auto-applied on deploy.

## Refactoring Guidelines

- Prefer **move + re-export (barrel)** over rewrites so import sites stay valid (see `src/lib/groq.ts`).
- Extract god-components into colocated subfiles; keep the public prop contract unchanged.
- Use `git mv` for renames to preserve history.
- One concern per commit; keep each phase green on the gate.

## Common Pitfalls

- Forgetting the per-request auth/ownership check (security regression).
- Adding a TS interface that duplicates a zod schema instead of `z.infer`.
- Writing fallback scores that permanently finalize a session on transient AI failure.
- Importing server-only modules (`server-only`, `@db`, actions) into client components.
- Editing generated files in `drizzle/` by hand instead of regenerating from `db/schema.ts`.

## Production Standards

Strict TS, ESLint + Prettier clean, green build in CI. Server-side authorization everywhere,
zod validation on all inputs, parameterized SQL, AI budget + rate limiting, idempotent scoring.
See [`docs/PRODUCTION_AUDIT.md`](docs/PRODUCTION_AUDIT.md) for the operational-readiness checklist
and remaining debt (tests, observability, shared-store rate limiting).
