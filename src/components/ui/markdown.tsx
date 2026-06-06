"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  AlertOctagon,
  AlertTriangle,
  CircleCheck,
  Info,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CLOZE_RE, CLOZE_TEST } from "@/lib/cloze";

/**
 * Safe Markdown renderer for user-authored content (study notes, etc.).
 *
 * Uses react-markdown + GFM (tables, task lists, strikethrough, autolinks).
 * Raw HTML is NOT enabled (no rehype-raw), so embedded markup is escaped and
 * rendered as text — untrusted content can't inject elements. Elements are
 * mapped to the design tokens since the project has no typography plugin.
 *
 * Two looks, chosen with `variant`:
 *  - "default"  — monochrome, design-token greys (used by Dojo).
 *  - "colorful" — colored headings/rules, tinted inline code, GitHub-style
 *                 callouts, and syntax-highlighted code blocks (study notes).
 *    The extra color lives in `.md-colorful` rules in globals.css plus the
 *    callout boxes below; syntax highlighting is added via rehype-highlight,
 *    which only tokenizes text (no raw HTML), so the XSS posture is unchanged.
 */

/** GitHub-style callout types: `> [!NOTE]`, `> [!TIP]`, … */
const CALLOUTS = {
  note: { label: "Note", Icon: Info, color: "var(--info)" },
  tip: { label: "Tip", Icon: Lightbulb, color: "var(--success)" },
  important: { label: "Important", Icon: CircleCheck, color: "var(--chart-5)" },
  warning: { label: "Warning", Icon: AlertTriangle, color: "var(--warning)" },
  caution: {
    label: "Caution",
    Icon: AlertOctagon,
    color: "var(--destructive)",
  },
} as const;

type CalloutKind = keyof typeof CALLOUTS;

const CALLOUT_RE = /^\s*\[!(note|tip|important|warning|caution)\]\s*\n?/i;

/** First text node in a React subtree, or null. */
function firstText(nodes: ReactNode): string | null {
  for (const node of Children.toArray(nodes)) {
    if (typeof node === "string") return node;
    if (isValidElement<{ children?: ReactNode }>(node)) {
      const found = firstText(node.props.children);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Remove the `[!TYPE]` marker from the first text node, keeping the rest. */
function stripMarker(nodes: ReactNode): ReactNode[] {
  let done = false;
  const visit = (node: ReactNode): ReactNode => {
    if (done) return node;
    if (typeof node === "string") {
      if (CALLOUT_RE.test(node)) {
        done = true;
        return node.replace(CALLOUT_RE, "");
      }
      return node;
    }
    if (isValidElement<{ children?: ReactNode }>(node)) {
      const kids = node.props.children;
      if (kids != null) {
        return cloneElement(node, {}, ...Children.toArray(kids).map(visit));
      }
    }
    return node;
  };
  return Children.toArray(nodes).map(visit);
}

function Callout({
  kind,
  children,
}: {
  kind: CalloutKind;
  children: ReactNode;
}) {
  const { label, Icon, color } = CALLOUTS[kind];
  return (
    <div
      className="my-3 rounded-lg border-l-4 py-2 pr-3 pl-3 [&>p]:my-0 [&>p+p]:mt-2"
      style={{
        borderColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <div
        className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase"
        style={{ color }}
      >
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      {children}
    </div>
  );
}

function makeComponents(colorful: boolean): Components {
  return {
    h1: ({ className, ...p }: ComponentPropsWithoutRef<"h1">) => (
      <h1
        className={cn(
          "mt-4 mb-2 text-xl font-bold first:mt-0",
          colorful &&
            "border-b border-[var(--border)] pb-1 text-[var(--chart-3)]",
          className,
        )}
        {...p}
      />
    ),
    h2: ({ className, ...p }: ComponentPropsWithoutRef<"h2">) => (
      <h2
        className={cn(
          "mt-4 mb-2 text-lg font-bold first:mt-0",
          colorful && "text-[var(--primary)]",
          className,
        )}
        {...p}
      />
    ),
    h3: ({ className, ...p }: ComponentPropsWithoutRef<"h3">) => (
      <h3
        className={cn(
          "mt-3 mb-1.5 text-base font-semibold first:mt-0",
          colorful && "text-[var(--chart-5)]",
          className,
        )}
        {...p}
      />
    ),
    p: ({ className, ...p }: ComponentPropsWithoutRef<"p">) => (
      <p className={cn("leading-relaxed", className)} {...p} />
    ),
    ul: ({ className, ...p }: ComponentPropsWithoutRef<"ul">) => (
      <ul className={cn("list-disc space-y-1 pl-5", className)} {...p} />
    ),
    ol: ({ className, ...p }: ComponentPropsWithoutRef<"ol">) => (
      <ol className={cn("list-decimal space-y-1 pl-5", className)} {...p} />
    ),
    a: ({ className, ...p }: ComponentPropsWithoutRef<"a">) => (
      <a
        className={cn(
          "font-medium text-[var(--primary)] underline underline-offset-2",
          className,
        )}
        target="_blank"
        rel="noopener noreferrer"
        {...p}
      />
    ),
    blockquote: ({
      className,
      children,
      ...p
    }: ComponentPropsWithoutRef<"blockquote">) => {
      if (colorful) {
        const lead = firstText(children);
        const match = lead?.match(CALLOUT_RE);
        if (match) {
          const kind = match[1].toLowerCase() as CalloutKind;
          return <Callout kind={kind}>{stripMarker(children)}</Callout>;
        }
      }
      return (
        <blockquote
          className={cn(
            "border-l-2 pl-3 text-[var(--muted-foreground)] italic",
            colorful ? "border-[var(--primary)]" : "border-[var(--border)]",
            className,
          )}
          {...p}
        >
          {children}
        </blockquote>
      );
    },
    hr: ({ className, ...p }: ComponentPropsWithoutRef<"hr">) => (
      <hr
        className={cn(
          colorful ? "border-[var(--primary)]/40" : "border-[var(--border)]",
          className,
        )}
        {...p}
      />
    ),
    code: ({
      className,
      children,
      ...p
    }: ComponentPropsWithoutRef<"code"> & { className?: string }) => {
      // Fenced blocks carry a `language-*` class; inline code never does.
      const isBlock = /language-|hljs/.test(className ?? "");
      if (isBlock) {
        return (
          <code className={cn("font-mono text-sm", className)} {...p}>
            {children}
          </code>
        );
      }
      return (
        <code
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[0.9em]",
            colorful
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-[var(--muted)]",
          )}
        >
          {children}
        </code>
      );
    },
    pre: ({ className, ...p }: ComponentPropsWithoutRef<"pre">) => (
      <pre
        className={cn(
          "overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-sm",
          className,
        )}
        {...p}
      />
    ),
    table: ({ className, ...p }: ComponentPropsWithoutRef<"table">) => (
      <div className="overflow-x-auto">
        <table
          className={cn(
            "w-full border-collapse text-sm [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[var(--border)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
            colorful &&
              "[&_th]:bg-[var(--accent)] [&_th]:text-[var(--accent-foreground)]",
            className,
          )}
          {...p}
        />
      </div>
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Cloze deletions (colorful variant only)                                    */
/* `{{c1::answer}}` or `{{c1::answer::hint}}` renders as a click-to-reveal      */
/* blank, turning any note into active-recall practice — retrieval beats       */
/* rereading for retention. A remark plugin splits the marker out of text      */
/* nodes into a custom `cloze` element that ClozeBlank renders.                */
/* -------------------------------------------------------------------------- */

/** Minimal mdast node shape we touch (avoids an `any` on the tree). */
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
}

/** Split a text value into text + `cloze` element nodes. */
function clozeNodes(value: string): MdNode[] {
  const out: MdNode[] = [];
  const re = new RegExp(CLOZE_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    if (m.index > last)
      out.push({ type: "text", value: value.slice(last, m.index) });
    out.push({
      type: "cloze",
      data: {
        hName: "cloze",
        hProperties: { answer: m[1] ?? "", hint: m[2] ?? "" },
      },
      children: [],
    });
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function remarkCloze() {
  return (tree: MdNode): void => {
    const walk = (node: MdNode): void => {
      if (!node.children) return;
      const next: MdNode[] = [];
      for (const child of node.children) {
        if (
          child.type === "text" &&
          child.value &&
          CLOZE_TEST.test(child.value)
        ) {
          next.push(...clozeNodes(child.value));
        } else {
          walk(child);
          next.push(child);
        }
      }
      node.children = next;
    };
    walk(tree);
  };
}

/** A hidden cloze answer; click (or focus + Enter) reveals it in place. */
function ClozeBlank({ answer, hint }: { answer?: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  if (shown) {
    return (
      <span className="rounded bg-[var(--success-subtle)] px-1 font-medium text-[var(--success)]">
        {answer}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      aria-label="Reveal hidden answer"
      className="rounded bg-[var(--accent)] px-2 font-medium text-[var(--accent-foreground)] underline decoration-dotted underline-offset-2 hover:bg-[var(--primary)]/15"
    >
      {hint ? hint : "[…]"}
    </button>
  );
}

const defaultComponents = makeComponents(false);
// `cloze` is a custom element emitted by remarkCloze; cast through unknown since
// react-markdown's Components type only enumerates standard HTML tags.
const colorfulComponents = {
  ...makeComponents(true),
  cloze: ClozeBlank,
} as unknown as Components;

export function Markdown({
  children,
  className,
  variant = "default",
}: {
  children: string;
  className?: string;
  variant?: "default" | "colorful";
}) {
  const colorful = variant === "colorful";
  return (
    <div
      className={cn(
        "space-y-3 text-sm break-words",
        colorful && "md-colorful",
        className,
      )}
      // Body prose reads in a softer tone than the (full-strength) note title;
      // set inline so it's immune to stylesheet layering/caching. Headings,
      // links, code and callouts set their own color, so they're unaffected.
      style={
        colorful
          ? {
              color:
                "color-mix(in srgb, var(--foreground) 45%, var(--muted-foreground))",
            }
          : undefined
      }
    >
      <ReactMarkdown
        remarkPlugins={
          colorful
            ? [remarkGfm, remarkCloze as unknown as typeof remarkGfm]
            : [remarkGfm]
        }
        rehypePlugins={colorful ? [rehypeHighlight] : []}
        components={colorful ? colorfulComponents : defaultComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
