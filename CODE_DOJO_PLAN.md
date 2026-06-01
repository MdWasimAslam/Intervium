# Code Dojo — personal coding practice ground

A private "gym" where you solve JS/DSA problems in a real editor, get AI nudges
(never answers), save every attempt, and resurface problems for spaced revision.
Fully separate from the interview engine, but sharing one editor component.

## Locked decisions

| Decision | Choice |
| --- | --- |
| Name / route | **Code Dojo** — `/dojo` |
| Editor | **Monaco** (`@monaco-editor/react`, CDN loader, client-only) |
| Runner | **In-browser sandboxed Web Worker** (no server execution) |
| Revision | **Both** — random-per-topic + Anki-style spaced repetition |
| AI hints | Tiered nudges via Groq, code-blocks stripped from output |
| Interview reuse | **Fast follow** — build shared editor now, wire into interviews in Phase 3 |

## Architecture

```
src/app/(app)/dojo/page.tsx          → question list/viewer (filters)
src/app/(app)/dojo/[slug]/page.tsx   → solve view (problem | editor + runner)
src/app/(app)/dojo/review/page.tsx   → spaced-repetition due queue (Phase 2)

src/components/code/                  ← SHARED (Dojo now, interviews later)
  CodeEditor.tsx                      → Monaco wrapper, themed, ssr:false
  runner.worker.ts                    → the sandbox (runs user code + tests)
  useJsRunner.ts                      → owns a worker per run, enforces timeout
  TestResults.tsx                     → pass/fail per case + console output

src/components/dojo/                   ← Dojo-only shell
  QuestionList.tsx, SolveShell.tsx, HintPanel.tsx (P2), ConfidenceRating.tsx (P2)

src/lib/dojo/types.ts                  → DojoTestCase, RunResult, etc.
src/lib/dojo/spaced-repetition.ts      → SM-2 lite (pure, unit-testable) (P2)
src/lib/actions/dojo.ts                → list / get / saveAttempt / random / rate

db/schema.ts                           → dojo_* tables (+ migration)
db/dojo-questions.json + db/seed-dojo.ts → curated starter set
```

## Data model (Drizzle / Postgres)

```
dojo_questions        id, slug, title, prompt(md), difficulty(enum),
                      starter_code, fn_name, test_cases(jsonb),
                      created_by(null = built-in), sort_order, is_active, created_at
dojo_topics           id, slug, name, sort_order
dojo_question_topics  question_id, topic_id            -- M:N tags (PK composite)
dojo_attempts         id, user_id, question_id, code, status(enum),
                      tests_passed, tests_total, runtime_ms, hints_used,
                      notes, created_at                 -- full history
dojo_progress         user_id, question_id, solved, attempts, last_attempted_at,
                      solved_at, ease, interval_days, due_at, last_confidence
                                                        -- PK (user_id, question_id); powers review
```

`dojo_attempts` = "save my answers". `dojo_progress` = per-question rollup that
drives revision. SR fields exist from day one so migrations stay stable, but are
only wired in Phase 2.

## Runner contract

Single-function problems for MVP. A question carries `fn_name` + `test_cases`:

```jsonc
{ "fnName": "twoSum",
  "testCases": [{ "input": [[2,7,11], 9], "expected": [0,1], "hidden": false }] }
```

The worker calls `twoSum([2,7,11], 9)`, deep-equals the result, and buffers
`console.log`. The main thread arms a ~4s timer and `worker.terminate()`s on
timeout → "Time limit exceeded (possible infinite loop)". Complex problems
(class design, order-insensitive output) get an optional per-question
comparator later; MVP stays single-function.

## AI hints (Phase 2)

Tiered: L1 approach/pattern · L2 data structure + complexity target · L3
pseudocode outline. Never working code. Guardrails = forbidding system prompt
**plus** a post-filter that strips fenced code blocks. `hints_used` is recorded
per attempt. Reuses the existing Groq + AI budget/logging infra.

## Spaced repetition (Phase 2)

After solving, rate **Again / Hard / Good / Easy**. SM-2 lite updates
`ease` + `interval_days` + `due_at`. `/dojo/review` = questions with
`due_at <= now`, soonest first. Logic lives in `spaced-repetition.ts` (pure).

## Phasing

- **Phase 1 (MVP):** shared `CodeEditor` + `useJsRunner` + `TestResults`; schema +
  migration; seed ~30 problems tagged by topic; `/dojo` list with
  topic/difficulty/status filters; `/dojo/[slug]` solve + save attempts + mark
  solved; **random-per-topic**. No AI, no SR yet.
- **Phase 2:** AI tiered hints + spaced repetition (rating + `/dojo/review`) +
  progress stats.
- **Phase 3 (fast follow):** coding-question type in interviews reusing
  `CodeEditor` / `useJsRunner` + scoring.

## Out of scope (for now)

Multi-language support, multiplayer/leaderboards, user-authored questions UI
(schema supports `created_by` but no UI yet), non-function problem shapes.
