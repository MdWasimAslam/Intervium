"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { updateFeatureModels } from "@/lib/actions/admin/settings";
import {
  AI_FEATURES,
  AI_PROVIDER_LABELS,
  MODEL_CATALOG,
  type AiProvider,
  type FeatureModelChoice,
  type FeatureModels,
} from "@/lib/ai/catalog";
import type { ScoringProvider } from "@/lib/settings";

const CUSTOM = "custom";
const DEFAULT = "";
/** Separator for encoding a catalog choice as a single <option> value. */
const SEP = ":::";

const fieldCls =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors dark:bg-[var(--surface-2)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/30";

function inCatalog(choice: FeatureModelChoice): boolean {
  return MODEL_CATALOG.some(
    (m) => m.provider === choice.provider && m.model === choice.model,
  );
}

/** The <select> value that represents a feature's current choice. */
function selectValue(choice: FeatureModelChoice | null): string {
  if (!choice) return DEFAULT;
  return inCatalog(choice) ? `${choice.provider}${SEP}${choice.model}` : CUSTOM;
}

export function AiModelsAdmin({
  featureModels,
  scoringProvider,
}: {
  featureModels: FeatureModels;
  scoringProvider: ScoringProvider;
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<
    Record<string, FeatureModelChoice | null>
  >(() => {
    const init: Record<string, FeatureModelChoice | null> = {};
    for (const f of AI_FEATURES) init[f.key] = featureModels[f.key] ?? null;
    return init;
  });
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const groups = useMemo(
    () => [...new Set(AI_FEATURES.map((f) => f.group))],
    [],
  );

  function setChoice(key: string, choice: FeatureModelChoice | null) {
    setSaved(false);
    setChoices((c) => ({ ...c, [key]: choice }));
  }

  function onSelect(key: string, value: string) {
    if (value === DEFAULT) return setChoice(key, null);
    if (value === CUSTOM) {
      const current = choices[key];
      // Keep the typed model when re-opening custom; otherwise start blank.
      return setChoice(key, {
        provider: current?.provider ?? "groq",
        model: current && !inCatalog(current) ? current.model : "",
      });
    }
    const sep = value.indexOf(SEP);
    setChoice(key, {
      provider: value.slice(0, sep) as AiProvider,
      model: value.slice(sep + SEP.length),
    });
  }

  function submit() {
    setError(undefined);
    setSaved(false);
    // Drop entries with an empty custom model — treat as "use default".
    const out: FeatureModels = {};
    for (const [key, choice] of Object.entries(choices)) {
      if (choice && choice.model.trim()) {
        out[key] = { provider: choice.provider, model: choice.model.trim() };
      }
    }
    start(async () => {
      const res = await updateFeatureModels({ featureModels: out });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const overrideCount = Object.values(choices).filter(
    (c) => c && c.model.trim(),
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI models</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Choose which model powers each AI feature. Features left on{" "}
          <span className="font-medium text-[var(--foreground)]">Default</span>{" "}
          use the global provider —{" "}
          <span className="font-medium text-[var(--foreground)]">
            {AI_PROVIDER_LABELS[scoringProvider]}
          </span>{" "}
          (change it in Settings).
        </p>
      </div>

      {groups.map((group) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle>{group}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {AI_FEATURES.filter((f) => f.group === group).map((f) => {
              const choice = choices[f.key];
              const value = selectValue(choice);
              const isCustom = value === CUSTOM;
              return (
                <div
                  key={f.key}
                  className="flex flex-col gap-2 border-b border-[var(--border)] pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {f.defaultHint}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      aria-label={`Model for ${f.label}`}
                      value={value}
                      onChange={(e) => onSelect(f.key, e.target.value)}
                      className={`${fieldCls} sm:w-72`}
                    >
                      <option value={DEFAULT}>Default</option>
                      {(["groq", "deepseek"] as AiProvider[]).map((provider) => (
                        <optgroup
                          key={provider}
                          label={AI_PROVIDER_LABELS[provider]}
                        >
                          {MODEL_CATALOG.filter(
                            (m) => m.provider === provider,
                          ).map((m) => (
                            <option
                              key={`${m.provider}${SEP}${m.model}`}
                              value={`${m.provider}${SEP}${m.model}`}
                            >
                              {m.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <option value={CUSTOM}>Custom…</option>
                    </select>

                    {isCustom && (
                      <div className="flex gap-2">
                        <select
                          aria-label={`Custom provider for ${f.label}`}
                          value={choice?.provider ?? "groq"}
                          onChange={(e) =>
                            setChoice(f.key, {
                              provider: e.target.value as AiProvider,
                              model: choice?.model ?? "",
                            })
                          }
                          className={fieldCls}
                        >
                          <option value="groq">Groq</option>
                          <option value="deepseek">DeepSeek</option>
                        </select>
                        <Input
                          aria-label={`Custom model id for ${f.label}`}
                          placeholder="model-id"
                          value={choice?.model ?? ""}
                          onChange={(e) =>
                            setChoice(f.key, {
                              provider: choice?.provider ?? "groq",
                              model: e.target.value,
                            })
                          }
                          className="sm:w-56"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {error && <Alert variant="error" title="Couldn’t save">{error}</Alert>}
      {saved && (
        <Alert variant="success" title="Saved">
          Model preferences updated.
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <span className="text-xs text-[var(--muted-foreground)]">
          {overrideCount === 0
            ? "All features on default"
            : `${overrideCount} feature${overrideCount === 1 ? "" : "s"} overridden`}
        </span>
      </div>
    </div>
  );
}
