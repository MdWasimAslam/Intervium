# Intervium

AI-powered mock interviews with instant, actionable feedback. Pick a role, tech
stack, focus area and difficulty; answer in your own words; get per-question
scoring and a results breakdown — all powered by **Groq model routing**. The app
also includes a CV workspace (ATS analysis, AI optimization, cover letters), a
gap-analysis view, and a "Code Dojo" coding-practice ground.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**,
**Drizzle ORM + Neon Postgres**, **Auth.js (NextAuth v5)**, and **shadcn/ui**.

> New here? Read [`CLAUDE.md`](CLAUDE.md) for architecture conventions and the
> "do-not-break" rules before making changes. Planning/audit docs live in
> [`docs/`](docs/README.md).

---

## Features

- 🔐 **Access-code gated registration** + email/password auth (JWT sessions, bcrypt)
- 🧭 **Onboarding wizard** that builds the candidate profile
- ⚙️ **Interview setup** wired entirely to admin-managed DB content
- 🤖 **Cache-first question engine** — reuses past questions, generates with Groq only when needed
- ⌨️ **Text & coding interviews** — type answers, or solve coding problems in an in-browser Monaco editor
- 📊 **AI scoring** with per-question feedback, strengths/improvements, and an overall summary
- 📄 **CV workspace** — import, edit, ATS scoring, AI optimization, and cover-letter generation
- 🥋 **Code Dojo** — a personal coding-practice ground with AI hints and spaced repetition
- 🛠️ **Admin panel** — full CRUD for roles, focus areas, tech stacks, access codes, questions, settings, and users
- 🧪 **QA Center** — an admin-only, environment-gated diagnostics dashboard
- 🌗 Light/dark themes, brand green `#00B775`, responsive, `prefers-reduced-motion` aware

---

## Tech Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16 (App Router)** | Server Components + Server Actions; route groups for `(app)` / `(public)` |
| Language | **TypeScript (strict)** | Zero `any`; types inferred from zod where possible |
| Question generation | **Groq llama-3.1-8b-instant** | Fast, generous free-tier budget, cache-friendly |
| Scoring & CV AI | **Groq llama-3.3-70b-versatile** | Stronger judgment for feedback, code review, ATS, rewrites |
| DB | **Neon Postgres** + **Drizzle ORM** | Serverless-friendly; HTTP driver for queries, WS pool for transactions |
| Auth | **Auth.js v5** Credentials + JWT | JWT strategy required for credentials; role carried on the session |
| UI | **Tailwind v4 + shadcn/ui** | Token-driven design system, light/dark |

---

## Architecture

Intervium adapts the classic layered backend to the Next.js App Router:

```
Route / Page (src/app/**)            server components fetch data, render client islands
  → Server Action (src/lib/actions)  'use server' — validate (zod) + authorize + orchestrate
    → Service / domain (src/lib/**)   business logic: scoring, question-engine, gap-analysis…
      → AI client (src/lib/ai/**)     Groq/DeepSeek HTTP, retry/timeout, prompt building
      → Data access (Drizzle + @db)   parameterized queries; withTransaction for multi-table writes
```

Key rules (see [`CLAUDE.md`](CLAUDE.md) for the full list):

- **Every** server action and API route re-checks `getCurrentUser()`/`requireAdmin()`
  server-side and scopes queries by `userId` (IDOR-safe) — middleware is a convenience, not the gate.
- Inputs are **zod-validated** before any DB or AI call; actions return a typed `{ ok, error }`.
- AI calls are guarded by a **daily budget** (`ai-budget.ts`) and **rate limiting** (`rate-limit.ts`),
  use **batch scoring** to minimize calls, and are **idempotent** (already-scored work is skipped).
- A **signature hash** (`sha256` of role + tech + focus + difficulty + interview type) keys the
  question cache, so identical configs share a pool and the app relies less on live AI over time.

---

## Folder Structure

```
db/                     Drizzle schema, client, migrations, seed/load scripts
drizzle/                Generated SQL migrations + snapshots
docs/                   Planning & audit documents (see docs/README.md)
src/
  app/                  App Router: (app) authed pages, (public) auth pages, api/ route handlers
  auth.ts, auth.config.ts, middleware.ts   Auth.js setup + edge route protection
  components/           UI by feature: admin, auth, cv, dojo, interview, onboarding, code, ui (shadcn)…
  lib/
    actions/            Server actions ('use server'), grouped by feature (+ admin/)
    ai/                 Groq/DeepSeek client + capability modules (interview, cv, skill-gap, dojo)
    cv/, dojo/, qa/     Domain logic per feature
    *.ts                Cross-cutting services: scoring, question-engine, dashboard, settings, env…
  constants/, types/    Shared constants and ambient type declarations
```

---

## Getting Started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:migrate           # apply migrations to your Neon database
npm run db:seed              # seed admin user, a demo role, and access codes
npm run dev                  # http://localhost:3000
```

The seed creates the admin account (default email `admin@intervium.app`). Set
`ADMIN_PASSWORD` before seeding to choose the password; if it's unset, the seed
generates a random one and prints **only** a notice to set/rotate it (never the
password itself). **Set or rotate the admin password before first login.**

### Environment variables

See [`.env.example`](.env.example) for the full, commented list. Summary:

| Var | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Neon Postgres connection string |
| `AUTH_SECRET` | ✅ | Signs Auth.js JWT sessions (`openssl rand -base64 32`) |
| `GROQ_API_KEY` | ✅ | Question generation, scoring, and CV AI |
| `GROQ_FAST_MODEL` / `GROQ_SMART_MODEL` | ⬜ | Override default Groq models |
| `GROQ_MODEL_LIMITS` / `AI_DAILY_BUDGET` | ⬜ | Tune AI usage limits/budget |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | ⬜ | Optional DeepSeek provider |
| `QA_DASHBOARD_ENABLED` | ⬜ | Force the QA Center on/off |
| `NEXT_PUBLIC_SITE_URL` | ⬜ | Absolute URL for OG/social images |

Required vars are validated at boot in [`src/lib/env.ts`](src/lib/env.ts) — the app fails fast with a clear message if any are missing.

---

## Development Workflow

1. Branch from `main`.
2. Make changes; keep server actions thin (validate → authorize → delegate to a service).
3. Run the local gate before pushing:
   ```bash
   npm run type-check && npm run lint && npm run format:check && npm run build
   ```
4. Open a PR. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same gate.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `type-check` / `format:check` | ESLint / TypeScript / Prettier |
| `npm run db:generate` / `db:migrate` / `db:seed` | Drizzle migrations & seed |
| `npm run db:load-questions` / `db:seed-dojo` / `db:demo` | Content loaders |

---

## API & Server Actions

Most mutations are **server actions** (`src/lib/actions/**`, `'use server'`), not REST endpoints —
they validate with zod, authorize, and return a typed `{ ok, error }`/`{ error }` result. There are
three HTTP route handlers under `src/app/api/`:

| Route | Purpose |
| --- | --- |
| `/api/auth/[...nextauth]` | Auth.js handler (sign-in/out, session) |
| `/api/interview/[sessionId]/questions` | Returns (and lazily generates) the question set for a session |
| `/api/qa/run` | Runs a QA Center diagnostic check (admin + env-gated) |

---

## Production Deployment (Vercel)

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the **Neon** integration (auto-sets `DATABASE_URL` / `POSTGRES_*`).
3. Set `AUTH_SECRET`, `GROQ_API_KEY`, and `NEXT_PUBLIC_SITE_URL`.
4. Deploy. Run `npm run db:migrate && npm run db:seed` against the production DB once.

Admin-managed content means the app can be reconfigured (new roles, questions,
timer, etc.) **without a redeploy**.

---

## Coding Standards

- **TypeScript strict**, zero `any`. Prefer inferring types from zod schemas (`z.infer`).
- **Naming:** PascalCase components & hooks files (`useFoo.ts`); kebab-case for non-component
  libs; shadcn `ui/*` stays lowercase by convention. Functions are verb-phrased and
  intention-revealing; booleans use `is/has/should`.
- **Server actions** stay thin: validate → authorize → delegate to a service; never trust the client.
- **Errors:** throw typed domain errors (`ScoringError`, `CvAiError`, …) inside services; actions
  catch and return `{ ok:false, error }`. Log with a `[context]` prefix.
- Run the local gate (type-check, lint, format, build) before every PR.

Full conventions and the critical "do-not-break" list are in [`CLAUDE.md`](CLAUDE.md).

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| App throws `Missing required environment variable(s)` at boot | A required var is unset — copy `.env.example` to `.env.local` and fill it in |
| `drizzle-kit` can't connect | `DATABASE_URL` not loaded — `drizzle.config.ts` reads `.env.local`; confirm it exists |
| Interviews fail to generate / score | Check `GROQ_API_KEY`; AI may be over the daily budget (`AI_DAILY_BUDGET`) — surfaced as a friendly message |
| Admin can't sign in | Re-run `npm run db:seed` (idempotent) and set `ADMIN_PASSWORD`, or reset via the admin panel |
| QA Center 404s | It's admin-only and disabled in production unless `QA_DASHBOARD_ENABLED=true` |

---

## Future Improvements

Tracked in detail in [`docs/PRODUCTION_AUDIT.md`](docs/PRODUCTION_AUDIT.md) and
[`docs/REFACTORING_AUDIT.md`](docs/REFACTORING_AUDIT.md). Highlights:

- Automated test suite (no test framework yet).
- Shared-store (Redis/Upstash) rate limiting for serverless.
- Error tracking / observability (Sentry/OTel) and structured logging.
- Migrate import sites from the `groq.ts` barrel to the `src/lib/ai/*` modules directly.
