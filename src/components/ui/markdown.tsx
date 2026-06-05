import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Safe Markdown renderer for user-authored content (study notes, etc.).
 *
 * Uses react-markdown + GFM (tables, task lists, strikethrough, autolinks).
 * Raw HTML is NOT enabled (no rehype-raw), so embedded markup is escaped and
 * rendered as text — untrusted content can't inject elements. Elements are
 * mapped to the design tokens since the project has no typography plugin.
 */

const components: Components = {
  h1: ({ className, ...p }: ComponentPropsWithoutRef<"h1">) => (
    <h1
      className={cn("mt-4 mb-2 text-xl font-bold first:mt-0", className)}
      {...p}
    />
  ),
  h2: ({ className, ...p }: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className={cn("mt-4 mb-2 text-lg font-bold first:mt-0", className)}
      {...p}
    />
  ),
  h3: ({ className, ...p }: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className={cn(
        "mt-3 mb-1.5 text-base font-semibold first:mt-0",
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
  blockquote: ({ className, ...p }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className={cn(
        "border-l-2 border-[var(--border)] pl-3 text-[var(--muted-foreground)] italic",
        className,
      )}
      {...p}
    />
  ),
  hr: ({ className, ...p }: ComponentPropsWithoutRef<"hr">) => (
    <hr className={cn("border-[var(--border)]", className)} {...p} />
  ),
  code: ({
    className,
    children,
    ...p
  }: ComponentPropsWithoutRef<"code"> & { className?: string }) => {
    // Fenced blocks carry a `language-*` class; inline code never does.
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-sm", className)} {...p}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[0.9em]">
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
          className,
        )}
        {...p}
      />
    </div>
  ),
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 text-sm break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
