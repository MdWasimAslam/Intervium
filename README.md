<div align="center">

# 🎯 Intervium

### Practice the interview. Then ace the real one.

**Intervium is an AI-powered mock-interview platform.** Run realistic practice
interviews, get every answer scored instantly with specific feedback, sharpen
your CV, drill coding problems, and turn your weak spots into study notes —
all in one place.

Built with **Next.js 16 · TypeScript · Tailwind v4 · Drizzle + Supabase Postgres · Auth.js v5 · Groq AI**

</div>

---

## ✨ What you can do

Think of Intervium as a personal interview coach that never sleeps.

### 🎤 Mock interviews that feel real

Pick a role, seniority, and focus, then answer in your own words — **behavioral,
system-design, or coding**. Coding questions run in a real in-browser editor
where you write and test code against test cases.

### ⚡ Instant, honest feedback

The moment you finish, every answer is **scored by AI** with:

- a clear score + rubric breakdown,
- what you did well and what to fix,
- a **model answer** and the exact concepts you missed.

### 🎯 Skill-gap analysis

See which topics keep dragging your scores down across sessions, with a focused
**learning path** to close the gaps before they cost you the offer.

### 📄 CV & ATS toolkit

Import your résumé, check it against **applicant-tracking systems (ATS)**, get
AI rewrite suggestions, and generate **tailored cover letters** in seconds.

### 🥋 Code Dojo

A coding gym with real problems. Run your solution against tests, get AI hints,
and let **spaced repetition** resurface the ones you fumbled.

### 📝 Study Notes

Your own knowledge base — **Markdown notes + flashcards**, folders & tags, and
**spaced-repetition review**. Plus the nice touches:

- `{{c1::cloze}}` blanks that turn any note into active recall,
- **read-aloud** (the browser speaks your notes),
- one-click **"save a weak interview answer as a note"**,
- export your notes as JSON.

### 🛡️ Progress Shield

One gamified dashboard card that turns **everything** you do into a single,
ever-rising score — **+5** per scored interview answer, **+8** per solved Code
Dojo problem, **+1** per study note. Your shield levels up through **eight
cycling ranks** (Initiate → Aspirant → Contender → Strategist → Sentinel →
Architect → Virtuoso → Sovereign) and then **prestiges** into the next cycle
(Cycle II, III, …) — it never ends, and later tiers cost progressively more
(power curve: `threshold(t) = round(80 × t²)`). The card shows your rank with
a unique SVG emblem per rank, a circular progress ring with tick marks, a
"+this week" delta, a breakdown across the three sources (nudging you toward
the one you've neglected), and fires a one-time celebration animation when you
tier up or prestige — all computed from data you already have, with no extra
tracking. Higher ranks progressively unlock visual upgrades: border nodes,
filigree, laurel wings, animated sparkle particles, and a holographic
color-shift overlay at Sovereign.

### 📊 Dashboard, history & streaks

Track your scores over time, revisit past interviews, and keep your daily streak
alive.

### 🛠️ For the owner (admin)

A full **admin panel** (roles, tech stacks, questions, access codes, AI models,
settings, users), a **QA diagnostics** dashboard, and a built-in **shareable
demo account** (more below).

### 🌗 Polished by default

Light/dark themes, a brand-green design system, fully responsive, and respects
`prefers-reduced-motion`.

---

## 🚀 Try it without an account — the Demo

Want to show the app to someone with zero friction? Intervium ships a **shared
demo account** ("John Doe") pre-loaded with sample interviews, notes, and
practice data:

- On the landing page, a visitor clicks **"Get demo access"**, gets a gentle
  nudge to ⭐ star the repo, then we **email them the login**.
- The demo account is **locked down**: AI features and destructive deletes are
  always off, so strangers can't run up your AI bill or wipe the showcase.
- Admins get a **on/off toggle**, a **one-click "Reset demo account"**, and
  simple **"who's trying it" analytics** — all in _Admin → Settings_.

---

## 🧠 How it works (in 3 steps)

```
1. Set the scene   →  pick role, focus, seniority, length
2. Interview       →  answer in your words (or code it live)
3. See what to fix →  instant scores, model answers, ranked weak spots
```

Behind the scenes, a **cache-first question engine** reuses past questions and
only calls the AI when it needs to — so the app gets cheaper and faster the more
it's used.

---

## 🛠️ Tech stack

| Layer     | Choice                               | Why it's here                           |
| --------- | ------------------------------------ | --------------------------------------- |
| Framework | **Next.js 16 (App Router)**          | Server Components + Server Actions      |
| Language  | **TypeScript (strict)**              | Zero `any`; types inferred from zod     |
| Styling   | **Tailwind v4 + shadcn/ui**          | Token-driven design system, light/dark  |
| Database  | **Supabase Postgres + Drizzle ORM**  | Managed Postgres, type-safe SQL         |
| Auth      | **Auth.js v5** (credentials + JWT)   | Role-aware sessions                     |
| AI        | **Groq** (fast + smart Llama models) | Question generation, scoring, CV, hints |
| Email     | **Resend**                           | Demo-access invites                     |

---

## 📁 Project structure

Everything is grouped by **feature**, so related code lives together.

```
intervium/
├─ db/                      # Database layer
│   ├─ schema.ts            #   all tables (the single source of truth)
│   ├─ index.ts, tx.ts      #   Drizzle client + transaction helper
│   ├─ migrate.ts           #   applies migrations
│   ├─ seed.ts              #   base data (admin user, a role, access codes)
│   ├─ demo-seed.ts         #   demo users + John Doe showcase account
│   ├─ demo-data.ts         #   the demo account's content (shared, no drift)
│   └─ seed-dojo.ts / load-questions.ts   # content loaders
│
├─ drizzle/                 # Auto-generated SQL migrations + snapshots
│
├─ docs/                    # Planning & audit notes (start at docs/README.md)
│
├─ src/
│   ├─ app/                 # Pages & routes (App Router)
│   │   ├─ (public)/        #   logged-out: landing, login, register
│   │   ├─ (app)/           #   logged-in: dashboard, interview, cv, dojo,
│   │   │                   #   study, gap-analysis, history, admin…
│   │   ├─ api/             #   3 HTTP routes (auth, questions, QA run)
│   │   ├─ layout.tsx       #   root layout (fonts, theme provider)
│   │   └─ globals.css      #   design tokens + animations
│   │
│   ├─ components/          # UI, grouped by feature
│   │   ├─ ui/              #   shadcn primitives (button, dialog, card…)
│   │   ├─ interview/  cv/  dojo/  study/  gap/  onboarding/
│   │   ├─ admin/           #   admin panel screens
│   │   ├─ layout/          #   header, nav, demo banner/modal
│   │   └─ marketing/  brand/   # landing page + logo
│   │
│   ├─ lib/                 # The brains
│   │   ├─ actions/         #   server actions ('use server') per feature (+ admin/)
│   │   ├─ ai/              #   Groq/DeepSeek client + prompts (interview, cv, dojo…)
│   │   ├─ cv/  dojo/  study/  qa/   # domain logic per feature
│   │   ├─ scoring.ts, question-engine.ts     # core interview services
│   │   ├─ demo.ts, demo-reset.ts, demo-analytics.ts, email.ts   # demo system
│   │   └─ session.ts, settings.ts, ai-budget.ts, rate-limit.ts, env.ts
│   │
│   ├─ auth.ts, auth.config.ts, middleware.ts   # Auth.js + route protection
│   └─ constants/, types/
│
└─ CLAUDE.md                # Architecture rules & "do-not-break" list (read before editing)
```

**The flow of a request, top to bottom:**

```
Page (src/app)  →  Server Action (src/lib/actions)  →  Service (src/lib)  →  AI (src/lib/ai)
                   validate + authorize                 business logic        + Database (Drizzle)
```

A few rules that keep it safe (full list in [`CLAUDE.md`](CLAUDE.md)):

- **Every** action re-checks who you are and scopes data to _your_ user (no peeking at others' data).
- **All inputs are validated** before any database or AI call.
- AI calls are **budget-capped, rate-limited, and idempotent** (already-scored work is never re-charged).

---

## ⚡ Getting started

```bash
npm install
cp .env.example .env.local    # then fill in the values
npm run db:migrate            # create the tables in your Supabase database
npm run db:seed               # admin user + a starter role + access codes
npm run dev                   # → http://localhost:3000
```

Optional content & demo:

```bash
npm run db:seed-dojo          # load Code Dojo practice problems
npm run db:demo               # create the demo accounts (incl. John Doe)
```

> The seed creates the admin account (`admin@intervium.app`). Set
> `ADMIN_PASSWORD` before seeding, or the seed makes a random one and tells you
> to rotate it. **Set/rotate the admin password before first login.**

### Environment variables

Full, commented list in [`.env.example`](.env.example). The essentials:

| Variable                              | Required | What it's for                                    |
| ------------------------------------- | -------- | ------------------------------------------------ |
| `DATABASE_URL`                        | ✅       | Supabase Postgres connection string              |
| `AUTH_SECRET`                         | ✅       | Signs login sessions (`openssl rand -base64 32`) |
| `GROQ_API_KEY`                        | ✅       | All AI: questions, scoring, CV, hints            |
| `AI_DAILY_BUDGET`                     | ⬜       | Daily cap on AI calls (default 180)              |
| `RESEND_API_KEY`                      | ⬜       | Sends demo-access invite emails                  |
| `DEMO_USER_EMAIL` / `DEMO_ACCESS_KEY` | ⬜       | The shared demo login (enables the demo system)  |
| `DEMO_INVITE_FROM`                    | ⬜       | Verified "from" address for invite emails        |
| `NEXT_PUBLIC_GITHUB_REPO_URL`         | ⬜       | Repo the demo "star" button points to            |
| `NEXT_PUBLIC_SITE_URL`                | ⬜       | Absolute URL for social/OG images + invite links |

Required vars are checked at boot ([`src/lib/env.ts`](src/lib/env.ts)) — the app
fails fast with a clear message if any are missing.

---

## 🧰 Scripts

| Script                                                   | What it does             |
| -------------------------------------------------------- | ------------------------ |
| `npm run dev`                                            | Start the dev server     |
| `npm run build` / `start`                                | Production build / serve |
| `npm run lint` / `type-check` / `format:check`           | The quality gate         |
| `npm test`                                               | Unit tests (tier engine) |
| `npm run db:generate` / `db:migrate` / `db:seed`         | Migrations & base seed   |
| `npm run db:demo` / `db:seed-dojo` / `db:load-questions` | Demo + content loaders   |

**Before every PR**, run the gate:

```bash
npm run type-check && npm run lint && npm run format:check && npm run build
```

---

## ☁️ Deploy (Vercel + Supabase)

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Create a **Supabase** project and set `DATABASE_URL` to its Postgres connection string (use the pooled connection for serverless).
3. Add `AUTH_SECRET`, `GROQ_API_KEY`, `NEXT_PUBLIC_SITE_URL` (and the demo vars if you want the demo).
4. Deploy, then run `npm run db:migrate && npm run db:seed` against the prod DB once.

> Migrations aren't auto-applied on deploy — run `db:migrate` against production
> after schema changes. Most content (roles, questions, timers, demo on/off) is
> **admin-editable without a redeploy**.

---

## 🩹 Troubleshooting

| Symptom                                            | Likely fix                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Missing required environment variable(s)` at boot | Copy `.env.example` → `.env.local` and fill it in                                       |
| `column "…" does not exist`                        | A migration isn't applied — run `npm run db:migrate`                                    |
| Interviews won't generate/score                    | Check `GROQ_API_KEY`; you may be over the daily AI budget (shown as a friendly message) |
| Demo login says "invalid"                          | Run `npm run db:demo`, and set `DEMO_USER_EMAIL` / `DEMO_ACCESS_KEY`                    |
| Demo banner/lock not showing                       | Set `DEMO_USER_EMAIL` and **restart** the server (env loads at startup)                 |
| Admin can't sign in                                | Re-run `npm run db:seed` (idempotent) and set `ADMIN_PASSWORD`                          |

---

## 🤝 Contributing & conventions

Architecture rules, naming, and the critical **"do-not-break"** list live in
[`CLAUDE.md`](CLAUDE.md). In short: strict TypeScript, server-side auth on every
action, zod-validate all inputs, keep actions thin, and keep the gate green.

---

<div align="center">

Built by [**Wasim Aslam**](https://wasimaslam.vercel.app/) ·
[GitHub](https://github.com/MdWasimAslam/Intervium)

If Intervium helped you prep, a ⭐ on the repo means a lot.

</div>