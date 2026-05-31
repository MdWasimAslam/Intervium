# Intervium

AI-powered mock interviews with instant, actionable feedback. Pick a role, tech
stack, focus area and difficulty; answer in your own words; get per-question
scoring and a results breakdown — all powered by **Groq model routing**.

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS v4**,
**Drizzle ORM + Neon Postgres**, **Auth.js (NextAuth v5)**, and **shadcn/ui**.

---

## Features

- 🔐 **Access-code gated registration** + email/password auth (JWT sessions, bcrypt)
- 🧭 **Onboarding wizard** that builds the candidate profile
- ⚙️ **Interview setup** wired entirely to admin-managed DB content
- 🤖 **Cache-first question engine** — reuses past questions, generates with Groq only when needed
- ⌨️ **Text & coding interviews** — type answers, or solve coding problems in an in-browser editor
- 📊 **AI scoring** with per-question feedback, strengths/improvements, and an overall summary
- 🛠️ **Admin panel** — full CRUD for roles, focus areas, tech stacks, difficulty bands, access codes, questions, settings, and users
- 🌗 Light/dark themes, brand green `#00B775`, responsive, `prefers-reduced-motion` aware

---

## Tech & AI choices

| Concern | Choice | Why |
| --- | --- | --- |
| Question generation | **Groq llama-3.1-8b-instant** | Fast, generous free-tier request budget, cache-friendly |
| Scoring, result summaries & CV AI | **Groq llama-3.3-70b-versatile** | Stronger judgment for feedback, code review, ATS analysis, and rewrites |
| DB | **Neon Postgres** + **Drizzle ORM** | Serverless-friendly; HTTP driver for queries, WS pool for the registration transaction |
| Auth | **Auth.js v5** Credentials + JWT | JWT strategy required for credentials; role on the session |

A **signature hash** (`sha256` of role + tech + focus + difficulty + interview
type) keys the question cache, so identical configs share a pool and the app
relies less on live AI calls over time.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:migrate           # apply migrations to your Neon database
npm run db:seed              # seed admin user, a demo role, and access codes
npm run dev                  # http://localhost:3000
```

### Environment variables

See [`.env.example`](.env.example). Summary:

| Var | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Neon Postgres connection string |
| `AUTH_SECRET` | ✅ | Signs Auth.js JWT sessions (`openssl rand -base64 32`) |
| `GROQ_API_KEY` | ✅ | Question generation, scoring, and CV AI |
| `GROQ_FAST_MODEL` | ⬜ | Question generation model; defaults to `llama-3.1-8b-instant` |
| `GROQ_SMART_MODEL` | ⬜ | Scoring/CV model; defaults to `llama-3.3-70b-versatile` |
| `NEXT_PUBLIC_SITE_URL` | ⬜ | Absolute URL for OG/social images |

### Database (Drizzle + Neon)

```bash
npm run db:generate   # generate SQL migrations from db/schema.ts
npm run db:migrate    # apply pending migrations
npm run db:seed       # seed baseline data (idempotent)
```

The seed creates the admin account (default email `admin@intervium.app`). Set
`ADMIN_PASSWORD` before seeding to choose the password; if it's unset, the seed
generates a random one and prints **only** a notice to set/rotate it (never the
password itself). **Set or rotate the admin password before first login.**

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `type-check` | ESLint / TypeScript |
| `npm run db:generate` / `db:migrate` / `db:seed` | Drizzle migrations & seed |

---

## Deploying to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the **Neon** integration (auto-sets `DATABASE_URL` / `POSTGRES_*`).
3. Set `AUTH_SECRET`, `GROQ_API_KEY`, and `NEXT_PUBLIC_SITE_URL`.
4. Deploy. Run `npm run db:migrate && npm run db:seed` against the production DB once.

---

## Project structure

```
db/                     Drizzle schema, client, migrations, seed
src/
  app/                  App Router pages, route handlers, admin panel
  components/           UI (shadcn-style), interview, onboarding, admin, brand
  lib/                  auth, session, groq, scoring, question-engine,
                        signature, rate-limit, settings, actions
```

Admin-managed content means the app can be reconfigured (new roles, questions,
timer, etc.) **without a redeploy**.
