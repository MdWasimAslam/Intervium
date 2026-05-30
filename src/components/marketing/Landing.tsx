import Link from "next/link";
import { Fraunces } from "next/font/google";
import {
  ArrowRight,
  ClipboardCheck,
  Gauge,
  Mic,
  MessagesSquare,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

/**
 * Distinctive editorial display face for headlines. The rest of the app keeps
 * its clean system sans — only the marketing headings borrow this voice. Wired
 * through a CSS variable that `.font-display` (globals.css) consumes.
 */
const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const STEPS = [
  {
    n: "01",
    Icon: SlidersHorizontal,
    title: "Set the scene",
    body: "Pick a role, seniority, and focus — behavioral, system design, or coding. Intervium tailors every question to the job you’re chasing.",
  },
  {
    n: "02",
    Icon: MessagesSquare,
    title: "Interview for real",
    body: "Answer by voice or in text. The AI listens, follows up, and presses on the gaps — just like the person across the table will.",
  },
  {
    n: "03",
    Icon: ClipboardCheck,
    title: "See what to fix",
    body: "Get an instant score, a model answer, and a ranked list of weak spots to drill before it actually counts.",
  },
] as const;

const FEATURES = [
  {
    Icon: Mic,
    title: "Text & voice interviews",
    body: "Practice the way you’ll really interview. Speak your answers or type them — Intervium transcribes and evaluates both.",
  },
  {
    Icon: Gauge,
    title: "Instant AI scoring",
    body: "Every answer is graded the moment you finish, with specifics on content, structure, and how you delivered it.",
  },
  {
    Icon: Target,
    title: "Weak-area tracking",
    body: "Intervium remembers where you slip and resurfaces those topics, so each session aims straight at your gaps.",
  },
] as const;

/**
 * Marketing landing page, shown to logged-out visitors only.
 * (Logged-in users are routed to the dashboard from `/`.)
 */
export function Landing() {
  return (
    <div className={cn(display.variable, "relative overflow-hidden")}>
      {/* Ambient: faint grid + a soft brand glow give the hero depth */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px]"
        aria-hidden
      >
        <div className="landing-grid absolute inset-0" />
        <div className="landing-glow absolute left-1/2 top-[-160px] h-[520px] w-[820px] -translate-x-1/2 rounded-full" />
      </div>

      {/* HERO — sized to fill the first screen below the sticky header */}
      <section className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-5xl items-center px-6 py-20 lg:py-24">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-up">
            <Chip>
              <Sparkles className="h-3 w-3" /> AI-powered mock interviews
            </Chip>
            <h1 className="font-display mt-5 text-[2.7rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-6xl">
              Practice the interview.{" "}
              <span className="block text-[var(--primary)]">
                Then ace the real one.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--muted-foreground)]">
              Realistic mock interviews over text or voice, instant AI scoring on
              every answer, and a clear path to fixing your weak spots — long
              before it counts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                Get started <ArrowRight />
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm text-[var(--muted-foreground)]">
              Free to start · No credit card · Behavioral, system design &amp;
              coding tracks
            </p>
          </div>

          <div className="animate-fade-up [animation-delay:120ms]">
            <ScoreCard />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative mx-auto max-w-5xl px-6 py-20">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold text-[var(--primary)]">
            How it works
          </span>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Three steps from rusty to ready.
          </h2>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ n, Icon, title, body }) => (
            <li key={n}>
              <Card className="h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--primary)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-2xl font-semibold text-[var(--border)]">
                    {n}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {body}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* FEATURE HIGHLIGHTS */}
      <section className="relative border-y border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--primary)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="relative mx-auto max-w-5xl px-6 py-24 text-center">
        <div
          className="landing-glow absolute left-1/2 top-1/2 -z-10 h-72 w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
          aria-hidden
        />
        <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">
          The best interview is the one you’ve already had.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[var(--muted-foreground)]">
          Run your first mock in minutes. No setup, no cost to start.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>
            Get started <ArrowRight />
          </Link>
        </div>
      </section>

      {/* QUIET FOOTER */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <span className="inline-flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="text-base font-bold tracking-tight">Intervium</span>
          </span>
          <nav className="flex items-center gap-6 text-sm text-[var(--muted-foreground)]">
            <Link href="#how-it-works" className="transition-colors hover:text-[var(--foreground)]">
              How it works
            </Link>
            <Link href="/login" className="transition-colors hover:text-[var(--foreground)]">
              Sign in
            </Link>
            <Link href="/register" className="transition-colors hover:text-[var(--foreground)]">
              Get started
            </Link>
          </nav>
          <span className="text-sm text-[var(--muted-foreground)]">
            © 2026 Intervium
          </span>
        </div>
      </footer>
    </div>
  );
}

/** A scored-answer preview that anchors the hero — shows the product at a glance. */
const RING_CIRCUMFERENCE = 2 * Math.PI * 40;
const BREAKDOWN = [
  { label: "Content", value: 92 },
  { label: "Structure", value: 80 },
  { label: "Delivery", value: 86 },
] as const;

function ScoreCard() {
  return (
    <div className="relative">
      <div
        className="landing-glow absolute -right-6 -top-8 h-44 w-44 rounded-full"
        aria-hidden
      />
      <Card className="relative p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            Behavioral · Senior
          </span>
          <Chip>
            <Sparkles className="h-3 w-3" /> Scored
          </Chip>
        </div>
        <p className="mt-3 text-sm font-medium">
          “Tell me about a time you led a project under real pressure.”
        </p>
        <div className="mt-3 rounded-xl bg-[var(--secondary)] p-3 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          “When our launch slipped two weeks out, I re-scoped to the core flow,
          split the team into two tracks…”
        </div>
        <div className="mt-4 flex items-center gap-5">
          <div className="relative h-[104px] w-[104px] shrink-0">
            <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="var(--secondary)"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE * 0.86} ${RING_CIRCUMFERENCE}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tracking-tight">8.6</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                / 10
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-2.5">
            {BREAKDOWN.map((b) => (
              <div key={b.label}>
                <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                  <span>{b.label}</span>
                  <span>{b.value}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[var(--secondary)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${b.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
