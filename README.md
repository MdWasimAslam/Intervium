# Next SaaS Starter

A production-ready **Next.js (App Router)** starter template with **TypeScript**, **Tailwind CSS**, a typed **Axios** API layer, mock **Route Handlers**, and **Vercel** deployment support. Use it as the foundation for your next SaaS application.

---

## ✨ Features

- ⚡ **Next.js (latest)** with the App Router
- 🟦 **TypeScript** in strict mode
- 🎨 **Tailwind CSS** with dark-mode support
- 🧹 **ESLint + Prettier** preconfigured
- 🔌 **Axios** client with request/response interceptors
- 🧱 Typed **service layer** + reusable **React hooks**
- 🛣️ **Route Handlers** for a full CRUD users API (mock JSON data)
- 🧩 Reusable UI: Button, Card, Loading / Error / Empty states, Navbar, Footer
- 🔔 Toast notifications via `react-hot-toast`
- ☁️ **Vercel-ready** out of the box

---

## 📁 Project Structure

```
.
├── src/
│   ├── app/                      # App Router: pages, layouts, API routes
│   │   ├── api/
│   │   │   └── users/
│   │   │       ├── route.ts          # GET (list), POST (create)
│   │   │       └── [id]/route.ts     # GET, PUT, DELETE (by id)
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── dashboard/page.tsx        # CRUD demo
│   │   ├── error.tsx                 # Route-level error boundary
│   │   ├── loading.tsx               # Route-level loading UI
│   │   ├── not-found.tsx             # 404 page
│   │   ├── layout.tsx                # Root layout (navbar/footer/toasts)
│   │   ├── page.tsx                  # Home page
│   │   └── globals.css
│   ├── api/                      # Server-side API helpers + mock data store
│   │   ├── mockUsers.ts
│   │   ├── response.ts
│   │   └── validation.ts
│   ├── components/
│   │   ├── layout/               # Navbar, Footer, Container
│   │   ├── providers/            # ToastProvider
│   │   ├── ui/                   # Button, Card, Spinner, *State
│   │   └── users/                # UserForm, UserCard
│   ├── constants/                # App-wide constants
│   ├── hooks/                    # useUsers (data + mutations)
│   ├── lib/                      # axios client (interceptors)
│   ├── services/                 # userService (typed API wrapper)
│   ├── types/                    # Shared TypeScript types
│   └── utils/                    # cn, formatters
├── .env.local.example
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── tailwind (v4 — configured in globals.css)
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20.9+** (required by Next.js 16)
- npm / pnpm / yarn / bun

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

| Variable              | Description                                  | Default                     |
| --------------------- | -------------------------------------------- | --------------------------- |
| `NEXT_PUBLIC_API_URL` | Base URL the Axios client uses for API calls | `http://localhost:3000/api` |

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Edit any file under `src/` and the page hot-reloads.

---

## 📜 Available Scripts

| Script                 | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the dev server                     |
| `npm run build`        | Production build                         |
| `npm run start`        | Start the production server              |
| `npm run lint`         | Run ESLint                               |
| `npm run format`       | Format files with Prettier               |
| `npm run format:check` | Check formatting without writing changes |
| `npm run type-check`   | Type-check with `tsc` (no emit)          |

---

## 🔌 API Documentation

All endpoints return a consistent JSON envelope:

```jsonc
// Success
{ "success": true, "data": <payload>, "message": "optional message" }

// Error
{ "success": false, "message": "what went wrong", "errors": { "field": "reason" } }
```

Base path: `/api`

### `GET /api/users`

Returns all users.

```bash
curl http://localhost:3000/api/users
```

### `GET /api/users/:id`

Returns a single user. Responds `404` if not found.

```bash
curl http://localhost:3000/api/users/1
```

### `POST /api/users`

Creates a user. Validates `name`, `email` and `role` (`admin | member | guest`).

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{ "name": "New User", "email": "new@example.com", "role": "member" }'
```

### `PUT /api/users/:id`

Updates a user with a partial payload. Responds `404` if not found.

```bash
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{ "role": "admin" }'
```

### `DELETE /api/users/:id`

Deletes a user. Responds `404` if not found.

```bash
curl -X DELETE http://localhost:3000/api/users/1
```

> **Note:** Data is stored in memory (`src/api/mockUsers.ts`) and resets when the
> server restarts. Swap this module for a real database client when ready.

---

## 🧱 Architecture Overview

```
UI (pages/components)
      │  calls
      ▼
useUsers() hook ──────────► loading / error / toast state
      │  uses
      ▼
userService.ts  ──────────► typed methods (getUsers, createUser, …)
      │  uses
      ▼
lib/axios.ts  ────────────► base URL, interceptors, error normalisation
      │  HTTP
      ▼
app/api/users/* (Route Handlers)
      │  uses
      ▼
src/api/* (mock data store, validation, response helpers)
```

This separation keeps components dumb, business logic testable, and the HTTP
details in one place.

---

## ☁️ Deploying to Vercel

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) and **import** the repo.
3. Vercel auto-detects Next.js — no build settings needed.
4. Add environment variables under **Settings → Environment Variables**:
   - `NEXT_PUBLIC_API_URL` → `https://<your-deployment>.vercel.app/api`
5. Click **Deploy**.

Or deploy from the CLI:

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

---

## 🛠️ Extending the Template

- **Add a real database:** replace `src/api/mockUsers.ts` with Prisma/Drizzle calls.
- **Add authentication:** attach a token in the request interceptor in `src/lib/axios.ts`.
- **Add a new resource:** mirror the `users` pattern — type → mock data → route handler → service → hook → UI.

---

## 📄 License

MIT — free to use for personal and commercial projects.
