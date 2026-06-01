# Question Bank Refactor — Migration Strategy

**Author:** Engineering · **Status:** Phase 1 complete (plan), Phases 2–8 implementation
**Scope:** `questions_cache`, `question-engine.ts`, `signature.ts`, Questions admin UI, admin server actions, CLI importer.

---

## 1. Current architecture

The "Question Bank" admin is a CRUD UI layered on top of `questions_cache` — a table originally designed as a **generation cache** for the interview engine, not a human-managed repository.

```
questions_cache
├─ id, job_role_id, tech_stack_id, focus_area_id   (FK columns)
├─ difficulty            text (free text, not FK)
├─ type                  enum(text|coding)         ← ANSWER MODALITY
├─ question_text, ideal_answer, language
├─ signature             text  = sha256(role|tech|focus|difficulty|interviewType)
├─ source                enum(ai|admin)
└─ is_active
```

- **`signature`** ([src/lib/signature.ts](src/lib/signature.ts)) is the cache key. The interview engine ([src/lib/question-engine.ts](src/lib/question-engine.ts#L86)) computes it from the session config and selects the matching active pool.
- **`interviewType`** (technical | behavioral | mixed | coding) is an *input to the hash only*. It is **not stored as a column** — it exists nowhere queryable.
- **Two "type" concepts collide:** `interview_type` (the pool / category, in the hash) vs. the `type` column (answer modality: text/coding).
- **Row count today:** 1,543 in production. `interview_type` enum already exists in PG (used by `interview_sessions`) with values `technical, behavioral, mixed, coding`.

## 2. Problems (from the audit)

| # | Problem | Root cause |
|---|---------|-----------|
| P1 | Can't filter by interview type with a WHERE clause | type is inside an opaque hash, not a column |
| P2 | Admin filter brute-forces **every possible signature** (triple-nested loop over role×tech×focus×difficulty) — [page.tsx:100-133](<src/app/(app)/admin/questions/page.tsx>#L100-L133) | same |
| P3 | Interview type & modality invisible in the table | not displayable from a hash |
| P4 | "Interview type" vs "Answer modality" both read as "type" | naming |
| P5 | Misfiled questions can't be re-filed (only delete+recreate) | changing config = changing signature; edit dialog forbids it |
| P6 | No JSON import in UI; CLI exists but can't import coding questions | [db/load-questions.ts](db/load-questions.ts) hardcodes `type:"text"` and excludes `coding` |
| P7 | Filter bar overloaded (8 controls, no grouping) | UX |

## 3. Proposed architecture

**Promote `interview_type` to a first-class column; keep `signature` as the cache key unchanged.**

```
questions_cache
├─ … (unchanged) …
├─ interview_type   enum(technical|behavioral|mixed|coding)  NOT NULL  ← NEW, indexed
└─ signature        text  (UNCHANGED algorithm & meaning — still the cache key)
```

- The engine keeps using `signature` for cache lookup. **No behavioral change to interview generation.**
- The admin filters on `interview_type` directly → the signature brute-force loop is deleted.
- Every insert path now persists `interview_type` explicitly.
- Terminology in the UI: **Question Category** (= interview_type) and **How Candidate Answers** (= modality). DB field names unchanged.
- New shared `importQuestions()` service backs both the CLI and a new admin Import-JSON dialog; supports coding + language.
- New `moveQuestion()` action recomputes the signature and re-files a question without delete/recreate.

### Backfill: how existing rows recover their interview_type

Existing rows have only the hash. But the hash is **deterministic** and was computed from the row's true type. So for each row we recompute the signature for all four candidate types using the row's known `job_role_id | tech_stack_id | focus_area_id | difficulty`, and the one whose hash equals the stored `signature` **is** the original type. This is a 100%-recoverable, lossless backfill (run in TS so it uses the identical `computeSignature`).

## 4. Migration plan (ordered, reversible)

1. **Schema** — add `interviewType: interview_type NOT NULL DEFAULT 'technical'` + index `questions_cache_interview_type_idx` to [db/schema.ts](db/schema.ts).
2. **Generate** — `npm run db:generate` → migration `0009_*.sql` (`ADD COLUMN` reusing the existing enum; the temporary `DEFAULT 'technical'` lets the NOT NULL column be added to the 1,543 populated rows).
3. **Backfill** — `npm run db:backfill-interview-type` recovers each row's true type by signature match (idempotent; safe to re-run).
4. **Code** — persist `interview_type` at all 8 insert sites; swap the admin filter to a WHERE clause; UI (terminology, columns, filters); `moveQuestion`; shared import service + Import dialog.
5. **Verify** — typecheck, lint, build, spot-check counts per type against the old enumeration.

The `DEFAULT 'technical'` is retained as a harmless safety net (all app inserts set the value explicitly). Dropping it is optional future cleanup.

## 5. Backward compatibility

- **Interview engine:** unchanged — still keyed by `signature`. Existing sessions, scoring, results unaffected.
- **`signature` algorithm:** untouched, so the entire existing cache stays valid (no orphaning).
- **Old CLI JSON files** (no `modality`/`language`): still valid — both fields are optional and default to text.
- **`session_questions` history & FKs:** untouched.
- **Additive column with default** ⇒ old running code (pre-deploy) keeps working during rollout (it just ignores the new column; the default satisfies NOT NULL for any insert that omits it). Deploy order is not load-bearing.

## 6. Rollback plan

| Failure point | Rollback |
|---|---|
| Backfill wrong/incomplete | Re-run backfill (idempotent). The column has no consumer except the admin filter, so a bad backfill only mis-filters the admin view — it never affects interviews. |
| Need to revert entirely | `ALTER TABLE questions_cache DROP COLUMN interview_type;` + `DROP INDEX questions_cache_interview_type_idx;` and revert the app commit. `signature` still drives everything, so dropping the column is safe and lossless. |
| Migration fails mid-apply | Single additive `ADD COLUMN` statement — Postgres applies it atomically; nothing partial to clean up. |

**Risk level: LOW** — additive, non-destructive, recoverable, and orthogonal to the runtime question-selection path.

## 7. Success criteria

- [x] Signature brute-force filter logic deleted; filtering is a direct indexed WHERE (plan confirmed using `questions_cache_interview_type_idx`).
- [x] Interview type visible & queryable; modality/language visible in the table.
- [x] Terminology disambiguated (Question Category vs. How Candidate Answers).
- [x] Filters split into primary + collapsible advanced.
- [x] Move-between-pools works without delete/recreate (recomputes signature, reconciles modality across the coding boundary).
- [x] JSON import in UI (validate + import, idempotent, coding+language).
- [x] typecheck / lint / build green; backfill verified against live data (519 technical / 480 behavioral / 480 mixed / 64 coding).

## 8. Phase 8 — adversarial review outcomes

A 6-dimension review (31 agents) surfaced **10 verified findings (0 high, 5 medium, 5 low)**. Resolutions:

| # | Sev | Finding | Resolution |
|---|-----|---------|-----------|
| 1/2 | Med | Unvalidated URL enum params (`?type`/`?modality`/`?source`) crash the page (PG 22P02) — a regression vs. the old enumeration's benign empty result | **Fixed** — `pickEnum()` validates against the literal set; `pickUuid()` added for `role`/`tech`/`focus` (same crash class, pre-existing). Dead `INTERVIEW_TYPES`/cast removed. |
| 3 | Med | Case-insensitive name resolution silently picks the first of colliding rows | **Fixed** — `resolveOne()` returns a block-level "ambiguous …" error on >1 match. |
| 4 | Med | `moveQuestion` didn't reconcile modality/language across the coding boundary | **Fixed** — moving into coding ⇒ `type='coding'` (+default language); out of coding ⇒ `type='text'`, `language=null`; modality preserved when coding-ness is unchanged. |
| 5 | Med | Move dialog kept stale config state on reopen | **Fixed** — body extracted to `MoveQuestionForm`, keyed on `question.id` and mounted only while open, so it re-seeds each time. |
| 9 | Low | `toggleQuestion` had no promise-rejection handling | **Fixed** — `ToggleActive` component with `useTransition` + try/catch + pending state. |
| 10 | Low | `AiGenerateDialog` notice/error not reset between opens | **Fixed** — reset on close. |
| 6, 8 | Low | Dedup / move duplicate-guard are non-atomic SELECT-then-write (TOCTOU); no DB-level uniqueness backstop | **Deferred — see tech debt.** |
| 7 | Low | Generic catch in import masks partial writes (non-transactional) | **Deferred — see tech debt.** |

## 9. Remaining technical debt

1. **No DB-level dedup uniqueness (TOCTOU).** Import dedup and the move duplicate-guard read-then-write without a transaction or a unique index. The correct fix is a normalized unique index, e.g. `UNIQUE (signature, lower(btrim(question_text)))`, plus `onConflictDoNothing()`. **Deliberately not added now** because the live bank already contains many near-identical AI rows — creating that index would *fail* until the data is de-duplicated first. Sequence: (a) dedupe existing rows, (b) add the index, (c) switch insert paths to `onConflictDoNothing`. Until then the window is tiny and admin-only.
2. **Import is not transactional.** A mid-batch failure can leave a partial insert; the action returns a generic error rather than partial counts. Wrap the per-block inserts in a transaction (or return the partial `ImportReport`) when (1) lands.
3. **`difficulty` is still free text**, not an FK to `difficulty_bands` (pre-existing; noted in PRODUCTION_AUDIT.md).
4. **Row actions are 4 inline icons.** A `⋯` overflow menu would declutter further but needs a dropdown primitive (`@radix-ui/react-dropdown-menu`) — not added to avoid a new dependency.
5. **Near-duplicate AI questions** in the bank are a data-quality issue the new layout makes visible; a "find duplicates" view would help (enabled by the normalization already used for dedup).

## 10. UI layout (post-review)

The first table iteration exposed every metadata field as its own column (9 columns), which inverted the hierarchy — the question text was the narrowest cell. Reworked to **question-first + subtitle**: the question is the dominant column; role · tech · focus · difficulty · source · language live in a compact muted subtitle; category is a single colour-coded chip; modality/source/difficulty columns removed (still filterable via Advanced). 5 columns total.
