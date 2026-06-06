/**
 * Canonical cloze-deletion syntax: `{{c1::answer}}` or `{{c1::answer::hint}}`.
 *
 * Single source of truth for the pattern so the Markdown renderer and any other
 * consumer (e.g. the read-aloud text-to-speech stripper) can never diverge —
 * notably both must use `[\s\S]` (not `.`) so a multi-line cloze answer matches.
 */

/** Cheap "does this text contain any cloze?" test (non-global, for `.test`). */
export const CLOZE_TEST = /\{\{c\d+::/;

/**
 * Full cloze matcher. Capture group 1 is the answer, group 2 the optional hint.
 * Global + `[\s\S]` so it spans newlines; build a fresh `RegExp` from `.source`
 * before stateful `.exec` loops to avoid a shared `lastIndex`.
 */
export const CLOZE_RE = /\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/** Replace every cloze with just its answer (drops the `cN::`/hint scaffolding). */
export function stripCloze(text: string): string {
  return text.replace(new RegExp(CLOZE_RE.source, "g"), "$1");
}
