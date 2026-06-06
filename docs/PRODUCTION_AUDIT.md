# Intervium — Production-Readiness Audit

**Date:** 2026-05-31  ·  **Reviewed build:** `main` @ `a59ddac`  ·  **Scope:** full app (17.7K LOC, Next.js 16 App Router, TypeScript, Drizzle + Supabase Postgres, Auth.js v5, Tailwind v4, shadcn/ui, Groq AI)

**Method:** static checks run against the repo (typecheck, lint, production build, dependency audit) + a 10-dimension code audit (auth, security, CRUD, AI engine, voice, UX, UI, a11y, performance, DB/ops) with every Critical/High finding adversarially re-verified against the actual source. File:line evidence is cited throughout.

---

# Executive Summary

**Overall score: 6.5 / 10**

**Production readiness: 🔴 Not Ready** (blocked by 1 Critical credential exposure + a cluster of High data-loss/reliability bugs). After the Critical and the 7 High items are fixed, this becomes **🟡 Almost Ready** — the underlying architecture is genuinely strong.

### What's good (don't lose this in the noise)
- **Clean build pipeline:** `tsc --noEmit` ✅, `eslint .` ✅, `next build` ✅ — zero type errors, zero lint errors, compiles for production.
- **Strong authorization posture:** every server action and API route re-checks `getCurrentUser()`/`requireAdmin()` server-side rather than trusting middleware. IDOR is systematically prevented via ownership scoping (`loadOwnedSession`, `userId` predicates). No `dangerouslySetInnerHTML`/`eval` sinks; AI output is zod-validated and React-escaped; SQL is parameterized.
- **Thoughtful AI resilience:** DB-backed daily budget guard, batch scoring (N calls → 1–2), hardened JSON parsing, and an atomic `FOR UPDATE` access-code claim.
- **Real attention to data-loss edges:** optimistic answer queue with retry + `beforeunload` guard, resume-on-reload, empty/loading states.

### Top Risks
1. **🔴 CRITICAL — Live admin credentials (plaintext + bcrypt hash) committed to the repo.** Full admin takeover of any default-seeded deployment.
2. **🟠 HIGH — A single transient Groq failure during scoring permanently zeroes a completed interview's scores** with no recovery path. This is the exact failure class from the prior 429 incident.
3. **🟠 HIGH — Timed voice interviews silently discard the candidate's spoken answer** when using the Whisper provider.
4. **🟠 HIGH — No rate limiting on login/registration** → credential stuffing + access-code enumeration.
5. **🟠 HIGH — Sessions are never revoked on deactivation/demotion** (JWT trusted for ~30 days, never reconciled with the DB).
6. **🟠 HIGH — Groq calls have no timeout**; a hung upstream stalls the function to its hard kill and returns an opaque 500.
7. **Operational blind spot:** no error tracking, monitoring, or analytics anywhere; rate limiter is in-memory (ineffective on serverless).

---

# Critical Issues

## C-1 🔴 Live admin password and its bcrypt hash committed to the repository
- **Severity:** Critical
- **Description:** `README.md:2-4` publishes the admin email, the working plaintext password `Intervium@Admin1`, **and** the exact bcrypt hash stored in the DB. `db/seed.ts:63-64` hardcodes the same password, inserts the user with `role:"admin"`, and `db/seed.ts:86-89` logs the email, plaintext password, and live hash to stdout. The verifier cryptographically confirmed `bcrypt.compareSync('Intervium@Admin1', <committed hash>) === true` — this is the *live* credential, not a stale placeholder.
- **Impact:** Full admin-panel takeover (users, access codes, questions, settings CRUD) on any deployment that ran the seed and didn't rotate the password. The committed hash also enables offline cracking confirmation. At scale, most operators won't rotate immediately — the in-code "change after first login" comment is not a mitigation.
- **Recommendation:** Remove the credentials block from `README.md` entirely. In `db/seed.ts`, require an `ADMIN_PASSWORD` env var (or generate a random one) and print it **once** at seed time; never commit a password or hash. Force a password change on first admin login. **Rotate the existing hash now and purge it from git history.**
- **Evidence:** `README.md:2-4`; `db/seed.ts:63-64`, `db/seed.ts:86-89`

---

# Functional Testing Results

| Check | Result | Notes |
|---|---|---|
| TypeScript (`tsc --noEmit`) | ✅ Pass | 0 errors |
| ESLint (`eslint .`) | ✅ Pass | 0 errors/warnings |
| Production build (`next build`) | ✅ Pass | 23 routes compiled; ⚠️ `middleware` convention deprecated in Next 16 → rename to `proxy` |
| Dependency audit (`npm audit --omit=dev`) | ⚠️ 5 moderate | `dompurify` (via `monaco-editor`), `postcss` XSS via unescaped `</style>` (via `next`) |
| Auth/authz (server-action + API guards) | ✅ Strong | Every mutation re-checks session+role server-side; IDOR prevented by ownership scoping |
| CRUD validation (zod on actions) | ✅ Mostly | All actions zod-validated and return typed `{ok,error}`; gaps below (transactions, swallowed errors) |
| Session lifecycle | ⚠️ Gaps | No revocation on deactivate/demote; no explicit `maxAge` (defaults to 30 days) |

**Functional bugs confirmed (detail in sections below):** mid-scoring zeroing (H-2), voice timer answer loss (H-3), duplicate-question race (M), non-transactional multi-writes (M ×2), hardcoded question-count vs admin setting (M), swallowed admin errors (M), false-success on no-op updates (saveCv/saveAnswer) (L).

---

# Critical & High Findings (verified)

## H-1 🟠 No rate limiting on login or registration
- **Impact:** Unthrottled online credential stuffing against any account, and brute-force of the access-code gate (codes are `INTV-` + 8 hex = only 32 bits of entropy). Distinct register errors ("Invalid" / "already used" / "expired") aid enumeration.
- **Fix:** Apply the existing `allowAction()` limiter (already used in 5 other hot paths) keyed by IP/email at the top of `loginAction` and `registerAction`; unify the access-code error message. Back it with Redis/Upstash for production (see M-rate-limit).
- **Evidence:** `src/lib/actions/auth.ts:116-139` (login), `:26-111` (register; distinct errors at 56/59/62); limiter exists at `src/lib/rate-limit.ts:14`.

## H-2 🟠 Transient scoring failure permanently zeroes a completed interview
- **Impact:** A single Groq 429/5xx during scoring writes fallback `{score:0}` to every answer in the group **and** sets `scoredAt`. The idempotency guards (`scoring.ts:44`, `:66`) then make this permanent — no later visit re-scores. The user's real answers survive in the DB but are scored 0 with "We couldn't score this answer automatically," and Retake is the only option. Triggers en masse during any Groq incident.
- **Fix:** Treat a true `ScoringError` like the `AiBudgetError` path: do **not** write fallback zeros and do **not** set `scoredAt` for failed groups. Throw to keep the session unscored so the "Try again" affordance actually re-scores, or persist a `pending` state and only finalize once all rows genuinely scored.
- **Evidence:** `src/lib/scoring.ts:131-135`, `:149-152`, `:162-183`, `:213-221`, `:44`, `:66`; contrast deferred path at `:107-111`.

## H-3 🟠 Timer auto-expiry discards the spoken answer (Whisper provider)
- **Impact:** On a timed voice interview using the server/Whisper provider, when the timer hits zero `submit()` reads the transcript **synchronously** right after `stop()` — but Whisper produces the transcript asynchronously in `recorder.onstop → fetch('/api/transcribe')`. The answer is enqueued blank and the late `setText` lands on the *next* question's state (corrupting it too). The candidate's entire spoken answer is lost and scored empty, with no error shown.
- **Fix:** For the server provider, have `stop()` return a `Promise<string>` resolving with the final transcript; `submit()` must await it before enqueue/advance on the timer path.
- **Evidence:** `src/components/interview/VoiceRunner.tsx:94-133`, `:168`; `src/lib/transcription/useServerTranscription.ts:84-112`.

## H-4 🟠 Session not revoked on deactivation or role demotion
- **Impact:** The `jwt` callback never re-reads the DB after sign-in; `isActive`/`role` are only checked at login. Deactivating a user or demoting an admin leaves their existing JWT fully valid (and `requireAdmin` still passes) until natural expiry (~30 days). Defeats deactivate/demote controls for incident response.
- **Fix:** In the `jwt` callback on refresh, re-fetch `isActive`/`role` by `token.id` and invalidate if inactive; or add a token-version column bumped on deactivation/role change. Pair with an explicit shorter `session.maxAge`.
- **Evidence:** `src/auth.config.ts:21-33`, `:14`; `src/auth.ts:39`; `src/lib/actions/admin/users.ts:56-59`, `:144-149`.

## H-5 🟠 Groq fetch has no timeout
- **Impact:** `getModel().generateContent` issues a bare `fetch()` with no `AbortController`. Under load/quota pressure the connection hangs, the function blocks until the platform hard-kills it (`maxDuration=60`), and the carefully-built `QuestionGenerationError`/`ScoringError` graceful path is bypassed — user sees a generic 500. The retry loop doesn't help (each attempt can independently hang).
- **Fix:** Wrap the fetch in `AbortSignal.timeout(25_000)` (below `maxDuration`) and map `AbortError` to the existing error types so the friendly UI path is preserved.
- **Evidence:** `src/lib/groq.ts:82-97`; `src/app/api/interview/[sessionId]/questions/route.ts:12`.

## H-6 🟠 Screen-reader users get no announcement of voice recording status
- **Impact:** "Listening…", "Transcribing…", and the mic-denied/unsupported/error messages all render as plain spans/`<p>` with no `aria-live`. A blind user pressing "Record answer" gets no feedback that recording started, is transcribing, or failed — making the voice mode (a primary feature) unusable. (The typing fallback keeps the interview *possible*, so High not Critical.)
- **Fix:** Wrap the status row in `role="status" aria-live="polite"`; use `aria-live="assertive"` for denied/error states.
- **Evidence:** `src/components/interview/VoiceRunner.tsx:211-242`.

## H-7 🟠 Admin Users page loads every user AND every session, unbounded
- **Impact:** `src/app/admin/users/page.tsx:9-37` runs two queries with no LIMIT — all users, and **all** `interview_sessions` across the entire platform — and ships both as serialized props into a client component, which then filters the full sessions array per user (`UsersAdmin.tsx:148-150`, O(users×sessions)). At thousands of users the page becomes multi-megabyte and effectively unloadable.
- **Fix:** Paginate the users query; load a user's sessions lazily inside `HistoryDialog` via a `LIMIT`ed server action keyed by `userId`, only on open.
- **Evidence:** `src/app/admin/users/page.tsx:9-37`; `src/components/admin/UsersAdmin.tsx:148-150`.

---

# Security Findings

> **Overall: strong for its category.** Consistent server-side authz, IDOR-safe ownership checks, zod validation everywhere, parameterized SQL, no HTML-injection sinks, secrets server-only. The residual issues are abuse/cost and AI-integrity, not auth-bypass/RCE.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| C-1 | 🔴 Critical | Committed live admin creds (see above) | `README.md:2-4`, `db/seed.ts:86-89` |
| H-1 | 🟠 High | No rate limit on login/register | `src/lib/actions/auth.ts:116-139` |
| S-1 | 🟡 Medium | **Prompt injection** — untrusted CV/JD/answer text concatenated raw into Groq prompts with no fencing | `src/lib/groq.ts:163,458,523-525,929-932` |
| S-2 | 🟡 Medium | `/api/transcribe` has **no size/MIME validation** — large body loaded fully into memory; cost/DoS (bounded by 30/min limiter + auth) | `src/app/api/transcribe/route.ts:66,92-102` |
| S-3 | 🟡 Medium | Abuse rate limiter is **in-memory** → ineffective across serverless instances | `src/lib/rate-limit.ts:8` |
| S-4 | 🟢 Low | Custom GET `/questions` endpoint mutates + calls Groq, cookie-only (no Origin/CSRF check); make it POST | `route.ts:21-62` |
| S-5 | 🟢 Low | Raw Groq upstream body logged server-side (`detail.slice(0,500)`) — may capture sensitive content | `src/lib/groq.ts:99-101` |
| S-6 | 🟢 Low | Registration password has no max length → bcrypt silently truncates at 72 bytes | `src/lib/actions/auth.ts:39-41` |
| Dep | 🟡 Medium | 5 moderate npm advisories (dompurify via monaco, postcss XSS via next) | `npm audit` |

**Prompt-injection fix (S-1):** move all untrusted text into clearly fenced, explicitly-labelled data blocks and add a system instruction to treat their contents as data, never instructions.

---

# UX Issues & Recommendations

| ID | Sev | Issue | Why it hurts | Recommended fix |
|---|---|---|---|---|
| UX-1 | 🟡 Medium | **"Skip" silently discards the answer** with no confirmation; skipped questions are marked answered and unreachable on resume | A misclick (button sits beside the answer area, always enabled) permanently zeroes a graded question | Confirm-on-skip when the field is non-empty, or relabel "Skip for now" + allow revisiting | `InterviewRunner.tsx:205-212` |
| UX-2 | 🟡 Medium | **Route error boundary leaks `error.message`** to users; only a "Try again" reset, no nav | Exposes technical/DB strings; user can get stuck with no escape | Fixed friendly copy in prod; add "Back to dashboard" link | `src/app/error.tsx:23-29` |
| UX-3 | 🟡 Medium | **No way to exit an in-progress interview** from the runner | User must use browser back / close tab to leave; feels trapped | Add persistent "Save & exit" that flushes the queue and reassures it's resumable | `InterviewRunner.tsx:136-242` |
| UX-4 | 🟡 Medium | **Accepting an AI-optimized CV overwrites the live CV** with no confirm/undo | An AI rewrite is irreversible; users lose their original | Confirm before overwrite + keep a recoverable pre-optimization revision | `OptimizePanel.tsx:54-58` |
| UX-5 | 🟡 Medium | **Question-generation failure is a dead end** — error card with no retry/escape | Stranded user, orphaned in-progress session | Add "Try again" + "Back to setup/dashboard" (mirror ScoringScreen) | `interview/[sessionId]/page.tsx:74-87` |
| UX-6 | 🟢 Low | Dashboard "Resume" surfaces only **one** of multiple in-progress sessions; `startInterview` never closes the old one | Stale in-progress rows accumulate; abandoned interviews only reachable via History | Detect existing in-progress session on start → prompt resume/discard; surface all resumable | `interview.ts:88-110`, `dashboard.ts:271` |
| UX-7 | 🟢 Low | Progress bar is off-by-one (`index/total`): shows 0% on Q1, never reaches 100% | Misleading progress feedback | Use `(index+1)/total` or `answered/total` | `InterviewRunner.tsx:145-152` |
| UX-8 | 🟢 Low | Retake immediately starts a new graded attempt, no confirmation/context | Surprise new session; retakes accumulate | Route through setup (prefilled) or add a confirm | `RetakeButton.tsx:16-27` |
| UX-9 | 🟢 Low | No "Forgot password?" recovery; register access-code field has no guidance on where to get a code | Locked-out users have no path; confused registrants | Add forgot-password link (or note if unsupported) + access-code help text | `login/page.tsx`, `register/page.tsx` |

---

# UI Improvements

> Design system is well-conceived: single token layer (light/dark) → Tailwind v4 → clean CVA/shadcn primitives; responsive containers, scroll-wrapped tables, reduced-motion CSS. The defects are polish/consistency.

| ID | Sev | Issue | Fix | Evidence |
|---|---|---|---|---|
| UI-1 | 🟡 Medium | **Dialog uses `animate-in`/`fade-in-0` utilities that aren't installed** — dead classes, no enter/exit motion | Install `tailwindcss-animate`/`tw-animate-css` or define keyframes; or remove dead classes | `dialog.tsx:17` |
| UI-2 | 🟡 Medium | Dialog close button uses `focus:outline-none` with **no focus-visible ring** (inconsistent with rest of system) | `focus-visible:ring-2 focus-visible:ring-[var(--ring)]` | `dialog.tsx:28` |
| UI-3 | 🟡 Medium | **Status badges inconsistent** — pill `<Chip>` for one state, bare muted text for the other | Add semantic Chip variants (success/warning/danger) and use for both states | `RolesAdmin.tsx:80-86`, `CodesAdmin.tsx:66-72` |
| UI-4 | 🟢 Low | Chip styling hand-duplicated instead of using `<Chip>` | Use the component | `InterviewSetup.tsx:315` |
| UI-5 | 🟢 Low | Page `H1` typography not standardized (`text-2xl`/`text-3xl` mix) | Single `PageHeading` token | `history/page.tsx:59` et al. |
| UI-6 | 🟢 Low | App body uses default system-ui font (intentional, but no brand typeface) | Optional: wire a `next/font` sans as `--font-sans` | `layout.tsx:43` |
| UI-7 | 🟢 Low | Inputs/select use `focus:` ring (fires on mouse), others use `focus-visible:` | Switch `SelectTrigger` to `focus-visible:` | `input.tsx:14`, `select.tsx:19` |

---

# Accessibility Findings

> Good foundation (Radix primitives, visible focus rings on most controls, reduced-motion CSS, avatar alt text). Defects cluster in live regions, JS animation, and form-error association.

| ID | Sev | Issue | Fix | Evidence |
|---|---|---|---|---|
| A11Y-1 | 🟠 High | Voice recording status silent to screen readers (see H-6) | `role="status" aria-live` | `VoiceRunner.tsx:211-242` |
| A11Y-2 | 🟡 Medium | **Save status & scoring progress not announced** (no live region) | `aria-live="polite"`/`assertive` on SaveStatus + ScoringScreen | `SaveStatus.tsx:15-29`, `ScoringScreen.tsx:33-58` |
| A11Y-3 | 🟡 Medium | **Framer-motion ignores `prefers-reduced-motion`**, incl. an infinite-loop celebration ping (CSS block doesn't cover JS animation) | `useReducedMotion()` / `MotionConfig reducedMotion="user"`; stop the `repeat:Infinity` ping | `OnboardingWizard.tsx:785-790,337-346` |
| A11Y-4 | 🟡 Medium | **Form errors not programmatically associated** (no `aria-invalid`/`aria-describedby`) | Add error prop → `aria-invalid` + `aria-describedby` → `role="alert"` element | `AuthField.tsx:9-28` |
| A11Y-5 | 🟡 Medium | **AccountMenu dropdown** doesn't move focus in/out or support arrow-key roving despite `role="menu"` | Use Radix DropdownMenu, or add focus-on-open + arrow nav + return-focus | `AccountMenu.tsx:25-101` |
| A11Y-6 | 🟡 Medium | Onboarding experience **Slider has no accessible name** | `aria-label="Years of experience"` + `aria-valuetext` | `OnboardingWizard.tsx:462-468` |
| A11Y-7 | 🟢 Low | No **skip-to-content** link; `<main>` not targetable | Add visually-hidden skip link + `id="main"` | `layout.tsx:42-49` |
| A11Y-8 | 🟢 Low | **ScoreRing** conveys the gauge purely visually | `role="img"` + `aria-label="Score X of Y, Z%"`; mark SVG `aria-hidden` | `ScoreRing.tsx:15-49` |
| A11Y-9 | 🟢 Low | `text-amber-500` and `--muted-foreground` may fall below 4.5:1 contrast | Token-based warning color meeting contrast in both themes | `QuestionResults.tsx:35,127` |

---

# Performance Findings

| ID | Sev | Issue | Fix | Evidence |
|---|---|---|---|---|
| P-1 | 🟠 High | Admin Users page loads all users + all sessions, unbounded (see H-7) | Paginate; lazy-load sessions per dialog | `admin/users/page.tsx:9-37` |
| P-2 | 🟡 Medium | **History page** loads every session a user ever ran, no pagination | Add LIMIT/OFFSET (admin questions page is the in-repo pattern) | `history/page.tsx:31-47` |
| P-3 | 🟡 Medium | **Dashboard + insights** each full-scan overlapping session/answer data into JS, no caching | Push aggregation into SQL (COUNT/AVG/window fns); cache | `dashboard.ts:181-192`, `insights.ts:103-135` |
| P-4 | 🟡 Medium | **Monaco editor statically imported** into the interview client bundle (loads even for non-coding/mobile) | `next/dynamic({ ssr:false })`, lazy-load on coding branch | `CodeEditor.tsx:4`, `InterviewRunner.tsx:13` |
| P-5 | 🟢 Low | Results page animates an unbounded list with cumulative `i*0.06` stagger | Cap stagger `Math.min(i,8)` | `QuestionResults.tsx:43-50` |
| P-6 | 🟢 Low | Question engine scans the user's **entire** session-question history per interview start | Constrain "seen" query to the relevant signature/pool | `question-engine.ts:108-118` |

**AI-engine reliability (overlaps perf/resilience):** no retry/backoff for 429/5xx (M, `groq.ts:99-102`); batch scoring is all-or-nothing per group — one bad id zeroes the whole batch (M, `groq.ts:583-589`); daily budget **fails open** on DB error, defeating its purpose (M, `ai-budget.ts:72-75`); duplicate-question race with no unique constraint (M, `question-engine.ts:65-84` + `schema.ts:277-285`).

---

# Mobile Experience Findings

- **Touch targets / responsiveness:** Layout primitives (`Container`, `Header`, admin shell) are responsive and tables get horizontal-scroll wrappers — good baseline.
- **Monaco on mobile (P-4):** the code editor is eagerly bundled even though a textarea fallback is intended for small screens; this inflates the mobile interview bundle. Code-split it.
- **Timer drift under tab-throttling (Low):** `QuestionTimer` decrements via `setInterval(…,1000)` instead of computing from a wall-clock start; backgrounding the tab drifts/double-counts. Drive remaining time from a start timestamp (`QuestionTimer.tsx:32-37`).
- **Reduced-motion (A11Y-3):** JS animations (including an infinite ping) ignore the OS reduced-motion setting — relevant to motion-sensitive mobile users.
- **Voice on mobile:** mic permission denial/unsupported states exist but are not announced (H-6) and the Whisper-timer path loses answers (H-3) — both hit mobile voice users hardest.

---

# Data Integrity & Server Actions

| ID | Sev | Issue | Fix | Evidence |
|---|---|---|---|---|
| D-1 | 🟡 Medium | `retryWeakAnswers` creates session + questions **without a transaction** → orphaned empty session (later a broken "Resume" target) | `withTransaction` | `practice.ts:154-179` |
| D-2 | 🟡 Medium | `resetUserAccountData` deletes across 3 tables **without a transaction** (deleteUser does wrap it) → half-wiped account | `withTransaction` | `users.ts:237-251` |
| D-3 | 🟡 Medium | Interview question-count hardcoded `[3,5,10]`, ignores admin-configurable `appSettings.questionCounts` | Load allowed counts from settings | `interview.ts:23-26` vs `settings.ts:11-14` |
| D-4 | 🟡 Medium | Admin row actions (toggle/duplicate) **swallow** `{ok,error}` → silent failure | Check `res.ok`, surface error | `QuestionsAdmin.tsx:411-418,649-654` |
| D-5 | 🟡 Medium | Difficulty-band overlap check is app-only, race-prone, no DB constraint | Postgres exclusion/unique constraint | `difficulty.ts:35-65` |
| D-6 | 🟢 Low | Focus areas / tech stacks have no uniqueness → duplicate names | Unique `(jobRoleId,name)` | `taxonomy.ts:25-32,72-79` |
| D-7 | 🟢 Low | `completeOnboarding` accepts an **inactive** role (startInterview requires active) | Add `isActive=true` check | `onboarding.ts:127-133` |
| D-8 | 🟢 Low | `saveCv`/`saveAnswer` return `ok:true` even when **0 rows updated** (false success) | Check `rowCount`; upsert for saveCv | `cv.ts:101-105`, `interview.ts:169-184` |

**Schema/migrations/ops:** all FKs are `ON DELETE no action` — integrity depends on hand-written cascade logic (M, `schema.ts`); migration `0006` `ALTER TYPE ADD VALUE` is irreversible/transaction-fragile (M); `difficulty` stored as free text instead of FK to `difficulty_bands` (M); no unique constraint on question signature (L); no migrate-on-deploy step and no documented backup/PITR strategy (L, `vercel.json`, `README.md:96`); no env validation at boot for `AUTH_SECRET`/`GROQ_API_KEY` (L).

---

# Production Readiness Checklist

| Area | Status | Blockers / notes |
|---|---|---|
| **Functionality** | 🟡 Mostly | Build/type/lint clean; data-loss bugs H-2, H-3, dup-question race, non-transactional writes to fix |
| **Security** | 🔴 Blocked | C-1 committed creds (rotate + purge history); then H-1, prompt injection, upload limits, dep advisories |
| **Authentication/Authz** | 🟡 Strong w/ gaps | Excellent server-side authz; fix session revocation (H-4) + explicit `maxAge` |
| **Performance** | 🟡 Mostly | Unbounded admin/history/dashboard queries (H-7, P-2, P-3); code-split Monaco |
| **Accessibility** | 🟡 Needs work | Live regions, reduced-motion, form-error association, menu focus |
| **Mobile** | 🟡 OK | Bundle weight + timer drift + voice issues |
| **Monitoring** | 🔴 Missing | No Sentry/Datadog/OTel; failures invisible to operators |
| **Logging** | 🔴 Ad hoc | 41 bare `console.error` calls → ephemeral function logs only |
| **Error tracking** | 🔴 Missing | No SDK / `instrumentation.ts` |
| **Analytics** | 🔴 Missing | No product analytics |
| **Rate limiting** | 🟡 Weak | In-memory only — ineffective on serverless; none on auth |
| **Backup strategy** | 🔴 Undocumented | No Supabase PITR/backup doc, no tested restore |
| **Deployment** | 🟡 Mostly | Builds on Vercel; manual migrations, no migrate-on-deploy; rename `middleware`→`proxy` (Next 16) |
| **Env validation** | 🟡 Partial | Only `DATABASE_URL` validated at boot |

---

# Final Verdict

**🔴 Not Ready for production launch — but close, and built on a genuinely solid foundation.**

The architecture, authorization model, and AI-cost discipline are above average for this class of app, and the codebase passes type-check, lint, and a production build cleanly. What blocks launch is a small, well-defined set of issues:

**Must-fix before launch (release blockers):**
1. **C-1** — rotate the admin credential, remove it from README/seed, purge git history.
2. **H-2** — stop permanently zeroing scores on transient AI failure.
3. **H-3** — stop losing spoken answers on the timed Whisper path.
4. **H-1** — rate-limit login/registration.
5. **H-4** — revoke sessions on deactivate/demote + set an explicit `maxAge`.
6. **H-5** — add a timeout to Groq calls.
7. **H-7 / P-2 / P-3** — bound the unbounded admin/history/dashboard queries.
8. **Observability** — add error tracking + structured logging (you are otherwise flying blind at scale).
9. **Rate limiter** — move to a shared store (Upstash/Redis) so throttling actually works on serverless.

**Strongly recommended (fast-follow):** prompt-injection hardening, `/api/transcribe` size/MIME limits, the accessibility live-region/reduced-motion/form-error set, transaction wrapping (D-1/D-2), Monaco code-splitting, and the destructive-action confirmations (UX-1/UX-4).

Fixing the 1 Critical + 7 High items (roughly a focused sprint) moves this to **🟡 Almost Ready**; adding observability and the Medium cluster gets it to a confident production launch.
