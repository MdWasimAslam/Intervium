# Question Bank — Hard Reset Implementation Plan

**Status:** Plan for review. No code changes until approved.
**Nature:** Destructive, no compatibility layers, obsolete code deleted.

---

## 0. Decisions baked into this plan (tell me if any is wrong)

These follow directly from your spec; flagging because each has a consequence:

1. **`bank_questions` has no `language` column.** Per "nothing else unless absolutely necessary." Consequence: **coding questions default to JavaScript** in the editor and code-scorer; TypeScript selection is gone. (If you want TS, that's one nullable `language` column — say so.)
2. **AI interviews are technical, text-only.** The AI flow is Role → Tech → Skill (no category, no modality input), so AI generates **technical text** questions only. **Behavioral and coding exist only in the curated bank.** Matches the flow you specified.
3. **History is preserved by inlining.** `session_questions` will store the question text/ideal-answer/modality inline (copied once from the old table) so Results/History keep rendering after the question bank is deleted. This is required — the results page currently joins the old table for `ideal_answer` + modality.
4. **Weak-area analytics is kept but regrouped to (role, tech).** It currently groups by focus + difficulty (both being deleted). Since "Analytics" is in your keep-list, I'll regroup it by role+tech rather than cut it. (Say the word and I'll cut it instead.)
5. **Per-interview Skill Level replaces profile-driven difficulty.** Profile `yearsExperience` stays only as the default preselect for the AI skill dropdown (0–1→Beginner … 6+→Expert).

---

## 1. Current architecture (what's being torn out)

- `questions_cache` — role, tech, **focus_area_id, difficulty, interview_type, signature**, modality (`type`), source, active. Holds both curated + AI rows.
- `signature` = SHA-256 cache key; the engine selects pools by it.
- `interview_sessions` carries `focus_area_id`, `difficulty`, `interview_type`.
- `session_questions` references questions by FK into `questions_cache`.
- `focus_areas`, `difficulty_bands` taxonomy tables + admin pages.
- `insights.ts` / `practice.ts` group "weak areas" by (tech, focus, difficulty).

## 2. Proposed architecture

- **One curated table** `bank_questions` (role, tech, category, modality, text, answer, active).
- **AI is ephemeral** — generated live, written only onto the session transcript, never pooled or cached.
- **No signature, no focus, no difficulty, no interview_type.**
- `interview_sessions` gains a `mode` discriminator + nullable `skill_level`.
- `session_questions` becomes self-contained (inline text/answer/modality).

---

## 3. Database changes (single destructive migration `0010`)

### New enums
```sql
CREATE TYPE interview_mode    AS ENUM ('bank','ai');
CREATE TYPE question_category AS ENUM ('technical','behavioral');
CREATE TYPE skill_level       AS ENUM ('beginner','intermediate','advanced','expert');
-- reuse existing question_type ('text','coding') for modality
```

### New table
```sql
CREATE TABLE bank_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid NOT NULL REFERENCES job_roles(id),
  tech_stack_id uuid NOT NULL REFERENCES tech_stacks(id),
  category      question_category NOT NULL,
  modality      question_type     NOT NULL,
  question_text text NOT NULL,
  ideal_answer  text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_questions_role_tech_idx ON bank_questions (role_id, tech_stack_id, active);
CREATE INDEX bank_questions_category_idx  ON bank_questions (category);
```

### Make `session_questions` self-contained (preserves history)
```sql
ALTER TABLE session_questions
  ADD COLUMN question_text text,
  ADD COLUMN ideal_answer  text,
  ADD COLUMN modality      question_type,
  ADD COLUMN bank_question_id uuid REFERENCES bank_questions(id);

-- one-time inline backfill from the table we're about to drop
UPDATE session_questions sq
   SET question_text = qc.question_text,
       ideal_answer  = qc.ideal_answer,
       modality      = qc.type
  FROM questions_cache qc
 WHERE sq.question_id = qc.id;

ALTER TABLE session_questions
  ALTER COLUMN question_text SET NOT NULL,
  ALTER COLUMN ideal_answer  SET NOT NULL,
  ALTER COLUMN modality      SET NOT NULL;

ALTER TABLE session_questions
  DROP CONSTRAINT session_questions_session_id_question_id_key,
  DROP COLUMN question_id;            -- drops the FK into questions_cache
```

### Strip dimensions from `interview_sessions`
```sql
ALTER TABLE interview_sessions
  ADD COLUMN mode interview_mode NOT NULL DEFAULT 'ai',   -- default only for historical rows
  ADD COLUMN skill_level skill_level;                     -- nullable; AI only
ALTER TABLE interview_sessions
  DROP COLUMN focus_area_id,         -- drop FK + column
  DROP COLUMN difficulty,
  DROP COLUMN interview_type;
```

### Drop old architecture
```sql
DROP TABLE questions_cache;          -- after inlining
DROP TABLE focus_areas;              -- no inbound FKs remain
DROP TABLE difficulty_bands;
DROP TYPE interview_type;            -- now unused
DROP TYPE question_source;           -- now unused
```

**Authoring note:** `drizzle-kit generate` emits structural ALTERs but not the data backfill, and won't guarantee ordering. I'll update `db/schema.ts` to the final state, generate, then **hand-edit** the migration to insert the `UPDATE` backfill and enforce the order above (same pattern as the existing `0008` migration). After applying, `drizzle-kit generate` must report **no drift**.

## 4. Data migration

No row migration for questions — **the bank starts empty** (you repopulate via Add / Bulk JSON Import). The only data step is the one-time `session_questions` inline backfill in §3 so historical interviews still render. Net effect: every question, pool, signature, difficulty/focus/type mapping is gone; users, roles, tech stacks, sessions, scores, answers, analytics remain.

## 5. Backup (runs before the migration)

1. `pg_dump "$DATABASE_URL" > backups/pre-reset-<date>.sql` (full logical backup).
2. Recommend also creating a **Neon branch** from the current DB as an instant restore point.
3. The migration is gated behind explicit approval; I will not run it otherwise.

---

## 6. Code changes — file by file

### Delete entirely
- `src/lib/signature.ts`
- `db/backfill-interview-type.ts`, `db/seed-questions.ts` (AI-bank seeding — obsolete)
- `src/app/(app)/admin/difficulty/` and `src/app/(app)/admin/focus-areas/` (pages)
- `src/components/admin/DifficultyAdmin.tsx`
- `src/lib/actions/admin/difficulty.ts`
- focus-area actions in `src/lib/actions/admin/taxonomy.ts` (`createFocus/updateFocus/deleteFocus`)
- `package.json` scripts: `db:seed-questions`, `db:backfill-interview-type`

### Rewrite
- **`db/schema.ts`** — new tables/enums; drop old (final-state source of truth).
- **`src/lib/question-engine.ts`** — split by `mode`:
  - `bank`: `SELECT … FROM bank_questions WHERE role,tech,active`, exclude this user's seen `bank_question_id`s, `ORDER BY random()`, take N; persist inline to `session_questions`.
  - `ai`: generate N live via Groq, write inline to `session_questions` (no pool write); on budget exhaustion → friendly "try Bank mode / tomorrow" (no cache fallback exists anymore).
- **`src/lib/groq.ts`** — generation keyed on `skill_level` (beginner→junior … expert→lead depth) instead of difficulty/interview_type; drop the behavioral/mixed/coding branches from AI gen; remove `generateQuestionBatch` (bank is never AI-generated).
- **`src/lib/scoring.ts`** — read `ideal_answer`/`modality` from `session_questions` inline; calibrate by `skill_level` for AI, neutral for bank; drop the difficulty adjective from the summary.
- **`src/lib/actions/interview.ts`** — `startInterview({ mode, jobRoleId, techStackId, skillLevel?, questionCount, timerEnabled })`; drop focus/difficulty/interview_type; `retakeSession` copies the new fields.
- **`src/lib/actions/admin/questions.ts`** — CRUD on `bank_questions` (add/edit/delete/bulk import/toggle active); remove AI-generate-into-bank, move-between-pools, signature/duplicate-by-signature.
- **`src/lib/questions/import.ts`** — new block shape `{ role, techStack, category, modality, questions:[{questionText, idealAnswer}] }`; name-based, idempotent dedup on (role,tech,category,modality,normalized text); no difficulty/focus/interview_type/signature.
- **`src/components/admin/QuestionsAdmin.tsx`** — filters Role/Tech/Category/Search; columns Question/Role/Tech/Category/Modality/Status; actions Add/Edit/Delete/Bulk JSON Import.
- **`src/components/interview/InterviewSetup.tsx`** — mode picker → Bank (Role→Tech→Start) or AI (Role→Tech→Skill→Start); remove focus/difficulty/interview_type/years-slider.
- **`src/lib/insights.ts`** + **`src/lib/actions/practice.ts`** — regroup weak areas by session `(role, tech)`; "retry weakest" replays inlined `session_questions`.

### Edit (light)
- `src/app/(app)/interview/new/page.tsx` — query roles + tech stacks only.
- `src/app/(app)/interview/[sessionId]/page.tsx` + `api/interview/[sessionId]/questions/route.ts` — pass `mode` to the engine.
- `src/app/(app)/interview/[sessionId]/results/page.tsx`, `history/page.tsx` — read modality/text from `session_questions`; drop difficulty/interview_type display (show mode + role/tech).
- dashboard widgets (`RecentActivity`, `LatestResult`, `WeakAreaCard`, `PrimaryAction`, `ProfileSummary`) — drop interview_type/difficulty chips.
- `src/components/admin/AdminSidebar.tsx` — remove Focus Areas + Difficulty Bands links.
- `src/lib/actions/admin/taxonomy.ts` — tech delete-guard counts `bank_questions` + sessions (not `questions_cache`/focus).
- `src/components/onboarding/OnboardingWizard.tsx` + `types.ts` — drop the difficulty-band display; keep years/skills/CV.
- `db/seed.ts`, `db/demo-seed.ts`, `db/questions.sample.json`, `db/question-prompt.md` — reseed/redocument for the new bank shape.

### Untouched
Users, roles, tech-stacks (tables + admin), access codes, settings, auth, CV, profile core.

---

## 7. Staging (ordered commits)

1. **DB** — schema.ts + destructive migration `0010` (backup → expand → inline backfill → drop). *Gated on approval.*
2. **Server logic** — engine (two modes), groq (skill-level), scoring.
3. **Server actions** — interview, admin/questions, import; delete difficulty/focus/seed-questions actions.
4. **Candidate UI** — InterviewSetup, interview/new, results, history, dashboard.
5. **Admin UI** — QuestionsAdmin, sidebar; delete difficulty/focus pages + components.
6. **Onboarding + analytics** — wizard, insights/practice regroup; seeds.
7. **QA** — typecheck/lint/build green; verify migration + no drift; smoke both modes end-to-end; verify a historical session's results still render from inlined data.

## 8. Risks

- **Irreversible once `questions_cache`/`focus_areas`/`difficulty_bands` drop.** Mitigated by the pre-migration backup + Neon branch.
- **AI mode has no fallback** when the daily Groq budget is spent (no cache). Mitigated by a clear message + keeping the rate-limit/budget guards.
- **Large surface (~40 files).** Mitigated by staged commits, each independently green.
- **Skill-level mis-self-assessment** affects AI difficulty — acceptable; default prefilled from profile years.

## 9. Rollback

- **Before migration:** nothing to roll back.
- **After migration, before deploy:** restore the `pg_dump` / promote the Neon branch; revert the app commits.
- **After deploy:** restore from backup (the dropped tables/columns cannot be reconstructed from app state — this is an accepted property of a destructive reset).
