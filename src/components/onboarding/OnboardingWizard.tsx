"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  ClipboardCheck,
  Code2,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { FormError } from "@/components/auth/FormError";
import { StepProgress } from "@/components/onboarding/StepProgress";
import { cn } from "@/lib/utils";
import {
  completeOnboarding,
  saveOnboardingStep,
  type OnboardingDraft,
} from "@/lib/actions/onboarding";
import type {
  BandOption,
  RoleOption,
  StackOption,
  WizardValues,
} from "@/components/onboarding/types";

const STEP_TITLES = [
  "Your name",
  "Primary role",
  "Experience",
  "Skills",
  "Goal",
  "Interview style",
  "CV",
  "Review",
];

const STYLE_OPTIONS = [
  {
    value: "text",
    label: "Text",
    hint: "Type your answers at your own pace.",
    icon: FileText,
  },
  {
    value: "voice",
    label: "Voice",
    hint: "Speak out loud, like a real interview.",
    icon: MessageSquare,
  },
  {
    value: "both",
    label: "A bit of both",
    hint: "Mix typing and speaking freely.",
    icon: Sparkles,
  },
] as const;

const MAX_YEARS = 20;
// Tap-friendly shortcuts for the experience step.
const YEAR_PRESETS = [0, 1, 2, 3, 5, 8, 12, 20];

const STEP_META: { icon: LucideIcon; title: string; subtitle: string }[] = [
  {
    icon: User,
    title: "First things first — what should we call you?",
    subtitle: "We'll use this to personalize your sessions.",
  },
  {
    icon: Briefcase,
    title: "Which role are you preparing for?",
    subtitle: "Pick the one closest to your target. Tap to choose.",
  },
  {
    icon: TrendingUp,
    title: "How much experience do you have?",
    subtitle: "We'll match the interview difficulty to your level.",
  },
  {
    icon: Code2,
    title: "What are your strongest skills?",
    subtitle: "Tap any that apply — or add your own.",
  },
  {
    icon: Target,
    title: "What are you working towards?",
    subtitle: "Optional, but it helps us focus your practice.",
  },
  {
    icon: MessageSquare,
    title: "How would you like to practice?",
    subtitle: "You can change this anytime. Tap to choose.",
  },
  {
    icon: FileText,
    title: "Want to add your CV?",
    subtitle: "Optional — paste it for sharper, tailored questions.",
  },
  {
    icon: ClipboardCheck,
    title: "Looking good — quick review",
    subtitle: "Make sure everything's right, then you're off.",
  },
];

interface Props {
  roles: RoleOption[];
  stacks: StackOption[];
  bands: BandOption[];
  initialValues: WizardValues;
  initialStep: number;
}

/** Find the difficulty band label for a role at a given years of experience. */
function bandFor(
  bands: BandOption[],
  roleId: string,
  years: number,
): string | null {
  const match = bands
    .filter((b) => b.jobRoleId === roleId)
    .find(
      (b) =>
        years >= (b.minYears ?? 0) &&
        years <= (b.maxYears ?? Number.MAX_SAFE_INTEGER),
    );
  return match?.label ?? null;
}

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
};

export function OnboardingWizard({
  roles,
  stacks,
  bands,
  initialValues,
  initialStep,
}: Props) {
  const [step, setStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [values, setValues] = useState<WizardValues>(initialValues);
  const [error, setError] = useState<string | undefined>();
  const [skillInput, setSkillInput] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [pending, startTransition] = useTransition();
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const set = <K extends keyof WizardValues>(key: K, value: WizardValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const roleStacks = useMemo(
    () => stacks.filter((s) => s.jobRoleId === values.primaryRoleId),
    [stacks, values.primaryRoleId],
  );
  const band = bandFor(bands, values.primaryRoleId, values.yearsExperience);
  const roleName =
    roles.find((r) => r.id === values.primaryRoleId)?.name ?? "—";
  const firstName = values.displayName.trim().split(/\s+/)[0] || "there";

  const isLast = step === STEP_TITLES.length - 1;
  // Role (1) and interview style (5) advance on tap, so they hide Next.
  const autoAdvances = step === 1 || step === 5;

  /** Client-side gate + the partial payload to persist for the current step. */
  function validateStep(): { ok: boolean; partial?: Partial<OnboardingDraft> } {
    switch (step) {
      case 0:
        if (!values.displayName.trim()) {
          setError("Please enter a display name.");
          return { ok: false };
        }
        return {
          ok: true,
          partial: { displayName: values.displayName.trim() },
        };
      case 1:
        if (!values.primaryRoleId) {
          setError("Please choose a role.");
          return { ok: false };
        }
        return { ok: true, partial: { primaryRoleId: values.primaryRoleId } };
      case 2:
        return {
          ok: true,
          partial: { yearsExperience: values.yearsExperience },
        };
      case 3:
        return { ok: true, partial: { skills: values.skills } };
      case 4:
        return { ok: true, partial: { targetRole: values.targetRole.trim() } };
      case 5:
        if (!values.interviewStyle) {
          setError("Please pick an interview style.");
          return { ok: false };
        }
        return {
          ok: true,
          partial: {
            interviewStyle: values.interviewStyle as Exclude<
              WizardValues["interviewStyle"],
              ""
            >,
          },
        };
      case 6:
        return { ok: true, partial: { cvText: values.cvText } };
      default:
        return { ok: true };
    }
  }

  /** Persist `partial` and move forward one step. */
  function goNext(partial: Partial<OnboardingDraft>) {
    setError(undefined);
    setDirection(1);
    const nextStep = step + 1;
    startTransition(async () => {
      const res = await saveOnboardingStep(partial, nextStep);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStep(nextStep);
    });
  }

  function handleNext() {
    setError(undefined);
    const { ok, partial } = validateStep();
    if (!ok) return;
    goNext(partial ?? {});
  }

  function handleBack() {
    setError(undefined);
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
  }

  /** Set a single-choice value and glide to the next step after a short beat. */
  function chooseAndAdvance(partial: Partial<OnboardingDraft>) {
    if (pending) return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => goNext(partial), 260);
  }

  function handleFinish() {
    setError(undefined);
    setFinishing(true);
    // Let the celebration land before the server action redirects.
    advanceTimer.current = setTimeout(() => {
      startTransition(async () => {
        const res = await completeOnboarding({
          displayName: values.displayName.trim(),
          primaryRoleId: values.primaryRoleId,
          yearsExperience: values.yearsExperience,
          skills: values.skills,
          targetRole: values.targetRole.trim(),
          interviewStyle: values.interviewStyle,
          cvText: values.cvText,
        });
        // On success the action redirects; only errors return here.
        if (res && !res.ok) {
          setError(res.error);
          setFinishing(false);
        }
      });
    }, 1200);
  }

  function toggleSkill(name: string) {
    setValues((v) => ({
      ...v,
      skills: v.skills.includes(name)
        ? v.skills.filter((s) => s !== name)
        : [...v.skills, name],
    }));
  }

  function addCustomSkill() {
    const name = skillInput.trim();
    if (name && !values.skills.includes(name)) {
      set("skills", [...values.skills, name]);
    }
    setSkillInput("");
  }

  const cvIsJson = useMemo(() => {
    const t = values.cvText.trim();
    if (!t) return null;
    try {
      JSON.parse(t);
      return true;
    } catch {
      return false;
    }
  }, [values.cvText]);

  if (finishing) {
    return <Celebration name={firstName} />;
  }

  const meta = STEP_META[step];

  return (
    <Container className="flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center py-10">
      <StepProgress steps={STEP_TITLES} current={step} />

      <div className="mt-8">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Heading */}
            <div className="mb-7">
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]">
                <meta.icon className="h-6 w-6" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {meta.title}
              </h1>
              <p className="mt-2 text-[var(--muted-foreground)]">
                {meta.subtitle}
              </p>
            </div>

            {/* Step 0 — Display name */}
            {step === 0 && (
              <div>
                <Input
                  value={values.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNext();
                  }}
                  placeholder="e.g. Alex Carter"
                  className="h-14 text-lg"
                  autoFocus
                />
              </div>
            )}

            {/* Step 1 — Primary role */}
            {step === 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {roles.map((role) => {
                  const selected = values.primaryRoleId === role.id;
                  return (
                    <motion.button
                      key={role.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        set("primaryRoleId", role.id);
                        chooseAndAdvance({ primaryRoleId: role.id });
                      }}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border p-4 text-left transition-colors",
                        selected
                          ? "border-[var(--primary)] bg-[var(--accent)]"
                          : "border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--muted)]",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors",
                            selected
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "bg-[var(--secondary)] text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]",
                          )}
                        >
                          {role.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {role.name}
                          </span>
                          {role.description && (
                            <span className="mt-0.5 line-clamp-2 block text-sm text-[var(--muted-foreground)]">
                              {role.description}
                            </span>
                          )}
                        </span>
                        {selected && (
                          <Check className="h-5 w-5 shrink-0 text-[var(--primary)]" />
                        )}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Step 2 — Years of experience */}
            {step === 2 && (
              <div className="space-y-7">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
                  <div className="flex items-baseline justify-center gap-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={values.yearsExperience}
                        initial={{ y: 8, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -8, opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.18 }}
                        className="text-5xl font-bold text-[var(--primary)]"
                      >
                        {values.yearsExperience}
                        {values.yearsExperience >= MAX_YEARS ? "+" : ""}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-lg text-[var(--muted-foreground)]">
                      {values.yearsExperience === 1 ? "year" : "years"}
                    </span>
                  </div>
                  {band ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-medium text-[var(--accent-foreground)]">
                      <Sparkles className="h-3.5 w-3.5" />
                      {band} level
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                      Difficulty will be set from your role.
                    </p>
                  )}
                </div>

                <Slider
                  min={0}
                  max={MAX_YEARS}
                  step={1}
                  value={[values.yearsExperience]}
                  onValueChange={([v]) => set("yearsExperience", v)}
                />

                <div className="flex flex-wrap gap-2">
                  {YEAR_PRESETS.map((y) => {
                    const selected = values.yearsExperience === y;
                    return (
                      <motion.button
                        key={y}
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={() => set("yearsExperience", y)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                          selected
                            ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "border-[var(--border)] hover:bg-[var(--muted)]",
                        )}
                      >
                        {y}
                        {y >= MAX_YEARS ? "+" : ""}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3 — Skills */}
            {step === 3 && (
              <div className="space-y-5">
                {roleStacks.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      Popular for {roleName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {roleStacks.map((s) => {
                        const selected = values.skills.includes(s.name);
                        return (
                          <motion.button
                            key={s.id}
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            onClick={() => toggleSkill(s.name)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                              selected
                                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                                : "border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--muted)]",
                            )}
                          >
                            {selected ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5 opacity-60" />
                            )}
                            {s.name}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomSkill();
                      }
                    }}
                    placeholder="Add another skill…"
                    className="h-11"
                  />
                  <Button type="button" variant="outline" onClick={addCustomSkill}>
                    <Plus />
                    Add
                  </Button>
                </div>

                {values.skills.length > 0 && (
                  <div className="border-t border-[var(--border)] pt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      {values.skills.length} selected
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <AnimatePresence initial={false}>
                        {values.skills.map((s) => (
                          <motion.span
                            key={s}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)]"
                          >
                            {s}
                            <button
                              type="button"
                              aria-label={`Remove ${s}`}
                              onClick={() => toggleSkill(s)}
                              className="rounded-full transition-opacity hover:opacity-70"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4 — Goal */}
            {step === 4 && (
              <div>
                <Input
                  value={values.targetRole}
                  onChange={(e) => set("targetRole", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNext();
                  }}
                  placeholder="e.g. Senior Frontend at a product company"
                  className="h-14 text-lg"
                  autoFocus
                />
              </div>
            )}

            {/* Step 5 — Interview style */}
            {step === 5 && (
              <div className="grid gap-3">
                {STYLE_OPTIONS.map((opt) => {
                  const selected = values.interviewStyle === opt.value;
                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        set("interviewStyle", opt.value);
                        chooseAndAdvance({ interviewStyle: opt.value });
                      }}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors",
                        selected
                          ? "border-[var(--primary)] bg-[var(--accent)]"
                          : "border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--muted)]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                          selected
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
                        )}
                      >
                        <opt.icon className="h-5 w-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold">{opt.label}</span>
                        <span className="block text-sm text-[var(--muted-foreground)]">
                          {opt.hint}
                        </span>
                      </span>
                      {selected && (
                        <Check className="h-5 w-5 shrink-0 text-[var(--primary)]" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Step 6 — CV */}
            {step === 6 && (
              <div>
                <Textarea
                  rows={9}
                  value={values.cvText}
                  onChange={(e) => set("cvText", e.target.value)}
                  placeholder="Paste plain text or JSON…"
                />
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Plain text or JSON both work.
                  {cvIsJson === true && (
                    <span className="ml-1 font-medium text-[var(--primary)]">
                      Detected valid JSON ✓
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Step 7 — Review */}
            {step === 7 && (
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                <ReviewRow label="Name" onEdit={() => jumpTo(0)}>
                  {values.displayName || "—"}
                </ReviewRow>
                <ReviewRow label="Primary role" onEdit={() => jumpTo(1)}>
                  {roleName}
                </ReviewRow>
                <ReviewRow label="Experience" onEdit={() => jumpTo(2)}>
                  {values.yearsExperience}
                  {values.yearsExperience >= MAX_YEARS ? "+" : ""} years
                  {band ? ` · ${band}` : ""}
                </ReviewRow>
                <ReviewRow label="Skills" onEdit={() => jumpTo(3)}>
                  {values.skills.length ? values.skills.join(", ") : "—"}
                </ReviewRow>
                <ReviewRow label="Goal" onEdit={() => jumpTo(4)}>
                  {values.targetRole || "—"}
                </ReviewRow>
                <ReviewRow label="Interview style" onEdit={() => jumpTo(5)}>
                  {values.interviewStyle
                    ? values.interviewStyle[0].toUpperCase() +
                      values.interviewStyle.slice(1)
                    : "—"}
                </ReviewRow>
                <ReviewRow label="CV" onEdit={() => jumpTo(6)}>
                  {values.cvText
                    ? `${values.cvText.trim().slice(0, 60)}${values.cvText.trim().length > 60 ? "…" : ""}`
                    : "Not provided"}
                </ReviewRow>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <div className="mt-5">
          <FormError message={error} />
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={handleBack}
          disabled={step === 0 || pending}
          className={step === 0 ? "invisible" : ""}
        >
          <ArrowLeft />
          Back
        </Button>

        {autoAdvances ? (
          <span className="text-sm text-[var(--muted-foreground)]">
            {pending ? "Saving…" : "Tap an option to continue"}
          </span>
        ) : isLast ? (
          <Button type="button" size="lg" onClick={handleFinish} disabled={pending}>
            <Check />
            Complete setup
          </Button>
        ) : (
          <Button type="button" onClick={handleNext} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Continue
            {!pending && <ArrowRight />}
          </Button>
        )}
      </div>
    </Container>
  );

  function jumpTo(target: number) {
    setError(undefined);
    setDirection(target > step ? 1 : -1);
    setStep(target);
  }
}

function ReviewRow({
  label,
  children,
  onEdit,
}: {
  label: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-3.5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm font-medium">{children}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

/** Full-screen "You're all set" moment shown while onboarding is finalised. */
function Celebration({ name }: { name: string }) {
  return (
    <Container className="flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center py-10 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]"
      >
        <motion.span
          className="absolute inset-0 rounded-full bg-[var(--primary)]"
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.18, type: "spring", stiffness: 400, damping: 18 }}
        >
          <Check className="h-12 w-12" strokeWidth={3} />
        </motion.div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl"
      >
        You&apos;re all set, {name}!
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="mt-2 text-[var(--muted-foreground)]"
      >
        Setting up your dashboard…
      </motion.p>

      <Loader2 className="mt-6 h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
    </Container>
  );
}
