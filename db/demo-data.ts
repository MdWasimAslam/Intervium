/**
 * Single source of truth for the "John Doe" showcase account's seeded content
 * AND the shared demo-account constants (credentials defaults, user-facing
 * messages, score-distribution helpers).
 *
 * Consumed by `db/demo-seed.ts` (the standalone CLI seed), `src/lib/demo-reset.ts`
 * (the in-app admin "Reset demo account" action), `src/lib/demo.ts`, and
 * `src/lib/email.ts`, so none of them can drift. Pure module — no DB import and
 * NO top-level `process.env` reads (the CLI seed loads dotenv after imports are
 * evaluated, so env-dependent values must be resolved lazily by the consumers
 * using the fallbacks below) — to stay usable from both the node script and the
 * Next server runtime.
 */

/* -------------------------------------------------------------------------- */
/* Shared demo-account constants (single source of truth)                     */
/* -------------------------------------------------------------------------- */

/** Default showcase email when `DEMO_USER_EMAIL` is unset (dev/local). */
export const DEMO_EMAIL_FALLBACK = "john.doe@intervium.app";
/** Default access key (password) when `DEMO_ACCESS_KEY` is unset. */
export const DEMO_ACCESS_KEY_FALLBACK = "Interview2026!";

/** Shown when the demo account hits a blocked AI capability. */
export const DEMO_AI_MESSAGE =
  "AI features are turned off in this demo account. Create a free account to try them.";
/** Shown when the demo account attempts a blocked delete. */
export const DEMO_DELETE_MESSAGE =
  "This is a shared demo account — deleting is disabled here.";

/** Normalize an email for demo-account comparison/storage (trim + lowercase). */
export function normalizeDemoEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Seeded session shape                                                       */
/* -------------------------------------------------------------------------- */

/** Per-session totals: a session is `Q` questions, each scored out of 10. */
export const DEMO_QUESTIONS_PER_SESSION = 5;
export const DEMO_PER_QUESTION_MAX = 10;
export const DEMO_SESSION_MAX =
  DEMO_QUESTIONS_PER_SESSION * DEMO_PER_QUESTION_MAX;
export const DEMO_SESSION_SUMMARY =
  "Solid answers with room to deepen system-design detail.";
export const DEMO_USER_ANSWER = "Demo answer.";

/**
 * Distribute a session `total` evenly across the `Q` questions (remainder spread
 * over the first few), so the per-question scores always sum back to `total`.
 * Shared by the seed and the reset so both produce identical transcripts.
 */
export function splitScore(
  total: number,
  q = DEMO_QUESTIONS_PER_SESSION,
): number[] {
  const base = Math.floor(total / q);
  const rem = total - base * q;
  return Array.from({ length: q }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Filler Q/A used for the demo transcripts (no AI is ever run for the demo). */
export const DEMO_INTERVIEW_Q = "Explain how you would design a rate limiter.";
export const DEMO_INTERVIEW_A =
  "Token bucket / sliding window, with tradeoffs.";

export const JOHN_PROFILE = {
  displayName: "John Doe",
  yearsExperience: 4,
  skills: [
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "System Design",
    "SQL",
  ],
  cvText:
    "Software developer (4 yrs) building React/Node web apps. Shipped a payments dashboard, led a search-latency project, and mentors two juniors.",
} as const;

/** Scored interviews. `stack` picks the primary or secondary tech stack. */
export interface DemoInterviewRun {
  stack: "primary" | "secondary";
  total: number;
  daysAgo: number;
  mode: "bank" | "ai";
}
export const JOHN_INTERVIEWS: DemoInterviewRun[] = [
  { stack: "primary", total: 32, daysAgo: 24, mode: "bank" },
  { stack: "secondary", total: 28, daysAgo: 18, mode: "ai" },
  { stack: "primary", total: 39, daysAgo: 11, mode: "ai" },
  { stack: "secondary", total: 35, daysAgo: 5, mode: "bank" },
  { stack: "primary", total: 43, daysAgo: 1, mode: "ai" },
];

/** Folder tree. Parents are listed before children so a key→id map resolves. */
export interface DemoFolder {
  key: string;
  parent: string | null;
  name: string;
  sortOrder: number;
}
export const JOHN_FOLDERS: DemoFolder[] = [
  { key: "js", parent: null, name: "JavaScript", sortOrder: 0 },
  { key: "fund", parent: "js", name: "Fundamentals", sortOrder: 0 },
  { key: "sd", parent: null, name: "System Design", sortOrder: 1 },
];

/** Notes/flashcards. `folder` references a folder `key` above. */
export interface DemoNote {
  folder: string;
  title: string;
  content: string;
  isFlashcard: boolean;
  tags: string[];
}
export const JOHN_NOTES: DemoNote[] = [
  {
    folder: "fund",
    title: "Closures",
    content:
      "A **closure** is a function bundled with references to its surrounding state. In JavaScript, a closure is created every time a function is {{c1::created}}, at function-definition time.\n\n```js\nfunction counter() {\n  let n = 0;\n  return () => ++n; // remembers n\n}\n```",
    isFlashcard: false,
    tags: ["javascript", "fundamentals"],
  },
  {
    folder: "fund",
    title: "Event loop",
    content:
      "The event loop runs the call stack, then drains the **microtask** queue (promises) before the next **macrotask** (timers, I/O). So `Promise.then` runs before `setTimeout(…, 0)`.",
    isFlashcard: false,
    tags: ["javascript", "async"],
  },
  {
    folder: "js",
    title: "What is the difference between == and ===?",
    content:
      "`===` checks value **and** type (no coercion); `==` coerces types before comparing. Prefer `===` to avoid surprising coercions.",
    isFlashcard: true,
    tags: ["javascript", "flashcard"],
  },
  {
    folder: "sd",
    title: "Rate limiter approaches",
    content:
      "> [!NOTE]\n> Common algorithms: **token bucket**, **leaky bucket**, **fixed window**, **sliding window log/counter**.\n\nToken bucket allows bursts up to the bucket size; sliding window smooths spikes at higher memory cost.",
    isFlashcard: false,
    tags: ["system-design"],
  },
  {
    folder: "sd",
    title: "When would you add a cache?",
    content:
      "When reads dominate writes and data tolerates slight staleness. Watch for **cache invalidation**, stampedes (use request coalescing), and a sensible **TTL**.",
    isFlashcard: true,
    tags: ["system-design", "flashcard"],
  },
];

/** How many built-in Dojo problems to mark solved for the demo account. */
export const JOHN_DOJO_SOLVED = 3;
