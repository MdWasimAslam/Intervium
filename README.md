# Intervium

A minimal, secure starter app built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **JWT authentication**, and **Neon Postgres** — with light/dark mode and Vercel deployment support.

There is **one hardcoded user** and **no registration** — sign in, and you reach a protected dashboard.

| | |
| --- | --- |
| **Username** | `admin` |
| **Password** | `Wasim@slam1998` |

---

## ✨ Features

- 🔐 **JWT authentication** (signed with `jose`, stored in an httpOnly cookie)
- 🐘 **Neon Postgres** via the serverless driver — the admin user is seeded automatically
- 🛡️ **Edge middleware** protects `/dashboard` and redirects based on auth state
- 🌗 **Light / dark mode** toggle (`next-themes` + Tailwind v4 class strategy)
- 🧱 Reusable UI: Button, Card, Spinner, Loading / Error states
- 🔔 Toast notifications via `react-hot-toast`
- ⚡ Next.js 16 + React 19 + strict TypeScript
- ☁️ **Vercel-ready** (works out of the box with the Vercel ↔ Neon integration)

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── login/route.ts      # POST  — verify credentials, set cookie
│   │       ├── logout/route.ts     # POST  — clear cookie
│   │       └── me/route.ts         # GET   — current user
│   ├── dashboard/page.tsx          # Protected (Server Component)
│   ├── login/page.tsx              # Public login page
│   ├── page.tsx                    # Landing page
│   ├── error.tsx | loading.tsx | not-found.tsx
│   ├── layout.tsx                  # Reads session; theme + toast providers
│   └── globals.css
├── api/response.ts                 # JSON response helpers
├── components/
│   ├── auth/                       # LoginForm, LogoutButton
│   ├── layout/                     # Navbar, Footer, Container
│   ├── providers/                  # ThemeProvider, ToastProvider
│   └── ui/                         # Button, Card, Spinner, *State, ThemeToggle
├── constants/index.ts
├── lib/
│   ├── db.ts                       # Neon client (lazy)
│   ├── jwt.ts                      # Edge-safe sign/verify (jose)
│   ├── seed.ts                     # ensureAdminUser + verifyCredentials (bcrypt)
│   └── session.ts                  # cookie read/write helpers
├── middleware.ts                   # Route protection
└── types/index.ts
```

---

## 🔑 How auth works

1. **Login** — `LoginForm` POSTs to `/api/auth/login`. The handler calls `ensureAdminUser()` (creates the `users` table and seeds `admin` on first run), verifies the password with **bcrypt**, then signs a **JWT** and stores it in the `intervium_token` httpOnly cookie.
2. **Protection** — `middleware.ts` runs on the Edge, verifies the token, and redirects: unauthenticated users away from `/dashboard`, and logged-in users away from `/login`.
3. **Reading the session** — Server Components call `getSession()` to read & verify the cookie. `/api/auth/me` exposes the same to the client.
4. **Logout** — `/api/auth/logout` deletes the cookie.

---

## 🚀 Local Development

### Prerequisites

- **Node.js 20.9+** (required by Next.js 16)
- A Neon database connection string (see below)

### 1. Install

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

| Variable       | Description                                                            |
| -------------- | ---------------------------------------------------------------------- |
| `POSTGRES_URL` | Neon connection string. Copy from your Neon / Vercel project settings. |
| `AUTH_SECRET`  | Secret used to sign JWTs. `openssl rand -base64 32`                    |

> The Neon serverless driver talks to Neon's endpoint, so a **real Neon
> connection string is required** even locally — a plain local Postgres
> won't work with this driver.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials above.

---

## 📜 Scripts

| Script                 | Description                |
| ---------------------- | -------------------------- |
| `npm run dev`          | Start the dev server       |
| `npm run build`        | Production build           |
| `npm run start`        | Start the production server|
| `npm run lint`         | Run ESLint                 |
| `npm run format`       | Format with Prettier       |
| `npm run type-check`   | Type-check with `tsc`      |

---

## 🔌 API

| Method | Endpoint           | Auth | Description                              |
| ------ | ------------------ | ---- | ---------------------------------------- |
| `POST` | `/api/auth/login`  | ❌   | Body `{ username, password }` → sets cookie |
| `POST` | `/api/auth/logout` | ✅   | Clears the session cookie                |
| `GET`  | `/api/auth/me`     | ✅   | Returns the current user                 |

All responses use the envelope `{ success, data, message }`.

---

## ☁️ Deploying to Vercel

1. Push the repository to GitHub and **import** it at [vercel.com/new](https://vercel.com/new).
2. Add the **Neon** integration (Vercel → Storage) — it auto-populates `POSTGRES_URL` and the other `POSTGRES_*` / `PG*` variables. ✅ _(already done for this project)_
3. Add one more environment variable: **`AUTH_SECRET`** (a long random string).
4. **Deploy.** The `users` table and `admin` account are created automatically on the first login.

---

## 🛠️ Notes

- Credentials are intentionally hardcoded in `src/lib/seed.ts` per the project brief. To change them, edit `ADMIN_USERNAME` / `ADMIN_PASSWORD` (and drop the `users` row / table so it re-seeds).
- There is no registration flow by design.
