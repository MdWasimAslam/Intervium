import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a question prompt with light markdown formatting.
 *
 * Interview prompts (especially coding ones) routinely embed fenced code
 * blocks (```lang … ```) and inline `code`. Rendered as raw text they show
 * literal backticks and lose all structure, so this splits the prompt into
 * formatted code blocks and prose, with monospace inline-code spans. It is
 * intentionally minimal — just the markdown that actually appears in prompts —
 * to avoid pulling in a full markdown dependency.
 */

type Block = { type: "code"; content: string } | { type: "text"; content: string };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const fence = /```[\w-]*\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = fence.exec(text)) !== null) {
    const before = text.slice(last, m.index).trim();
    if (before) blocks.push({ type: "text", content: before });
    blocks.push({ type: "code", content: m[1].replace(/\n$/, "") });
    last = fence.lastIndex;
  }

  const tail = text.slice(last).trim();
  if (tail) blocks.push({ type: "text", content: tail });

  // Nothing matched (or empty) — fall back to the whole string as prose.
  if (blocks.length === 0) blocks.push({ type: "text", content: text });
  return blocks;
}

/** Render a text run, turning `inline code` into styled spans. */
function renderInline(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) => {
    if (part.length > 1 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[0.9em] font-normal"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function QuestionPrompt({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseBlocks(text);

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((b, i) =>
        b.type === "code" ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-sm font-normal"
          >
            <code className="font-mono">{b.content}</code>
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(b.content)}
          </p>
        ),
      )}
    </div>
  );
}
