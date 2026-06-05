"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Normalize one entered tag the same way the server action does. */
function clean(raw: string): string {
  return raw.replace(/^#+/, "").trim().toLowerCase();
}

/** Chip-style tag editor: type and press Enter/comma to add, × to remove. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const tag = clean(raw);
    if (tag && !value.includes(tag) && value.length < 10) {
      onChange([...value, tag]);
    }
    setDraft("");
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]"
          >
            #{tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => remove(tag)}
              className="rounded-full hover:text-[var(--destructive)]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        list="study-tag-suggestions"
        placeholder={value.length >= 10 ? "Tag limit reached" : "Add a tag…"}
        disabled={value.length >= 10}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length > 0) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      <datalist id="study-tag-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
