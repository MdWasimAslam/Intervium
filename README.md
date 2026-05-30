# Intervium
email: admin@intervium.app
password (plaintext placeholder): Intervium@Admin1
bcrypt hash stored: $2b$10$ts4vF/5KpkRqjdJwQwUL/.c1Zhp6wBsE59O/TzGouesXn4pPHMubG

AI-powered mock interviews with instant, actionable feedback. Pick a role, tech
stack, focus area and difficulty; answer by **text or voice**; get per-question
scoring and a results breakdown — all powered by **Gemini 2.5 Flash**.

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS v4**,
**Drizzle ORM + Neon Postgres**, **Auth.js (NextAuth v5)**, and **shadcn/ui**.

---

## Features

- 🔐 **Access-code gated registration** + email/password auth (JWT sessions, bcrypt)
- 🧭 **Onboarding wizard** that builds the candidate profile
- ⚙️ **Interview setup** wired entirely to admin-managed DB content
- 🤖 **Cache-first question engine** — reuses past questions, generates with Gemini only when needed
- ⌨️ **Text** and 🎙️ **voice** interviews (Web Speech by default; Groq Whisper drop-in)
- 📊 **AI scoring** with per-question feedback, strengths/improvements, and an overall summary
- 🛠️ **Admin panel** — full CRUD for roles, focus areas, tech stacks, difficulty bands, access codes, questions, settings, and users
- 🌗 Light/dark themes, brand green `#00B775`, responsive, `prefers-reduced-motion` aware

---

## Tech & AI choices

| Concern | Choice | Why |
| --- | --- | --- |
| Question generation & scoring | **Gemini 2.5 Flash** (`@google/generative-ai`) | Fast, cheap, strong JSON output; server-side only |
| Voice transcription | **Web Speech API** (default), **Groq Whisper-large-v3** (optional) | Web Speech is free & client-side; Groq behind one interface for later |
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
| `GEMINI_API_KEY` | ✅ | Question generation + scoring (server-only) |
| `GROQ_API_KEY` | ⬜ | Only if transcription provider = `groq` |
| `NEXT_PUBLIC_SITE_URL` | ⬜ | Absolute URL for OG/social images |

### Database (Drizzle + Neon)

```bash
npm run db:generate   # generate SQL migrations from db/schema.ts
npm run db:migrate    # apply pending migrations
npm run db:seed       # seed baseline data (idempotent)
```

The seed prints the admin credentials (default `admin@intervium.app`). **Change
the password after first login.**

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
3. Set `AUTH_SECRET`, `GEMINI_API_KEY`, and `NEXT_PUBLIC_SITE_URL`
   (and `GROQ_API_KEY` if using Groq).
4. Deploy. Run `npm run db:migrate && npm run db:seed` against the production DB once.

---

## Project structure

```
db/                     Drizzle schema, client, migrations, seed
src/
  app/                  App Router pages, route handlers, admin panel
  components/           UI (shadcn-style), interview, onboarding, admin, brand
  lib/                  auth, session, gemini, scoring, question-engine,
                        signature, rate-limit, settings, transcription, actions
```

Admin-managed content means the app can be reconfigured (new roles, questions,
timer, etc.) **without a redeploy**.
