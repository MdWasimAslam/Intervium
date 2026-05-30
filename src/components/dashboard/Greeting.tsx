"use client";

import { useSyncExternalStore } from "react";

/** Map the current local hour to a friendly greeting. */
function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Hydration-safe "are we on the client yet?" — server snapshot is `false`,
// client snapshot is `true`, so React swaps to the client value after
// hydration without a mismatch (and without setState-in-effect).
const noopSubscribe = () => () => {};

/**
 * Greeting headline. Renders "Welcome back" during SSR / first paint and
 * upgrades to a time-of-day greeting on the client, using the visitor's local
 * clock.
 */
export function Greeting({ name }: { name: string }) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const greeting = isClient ? timeGreeting() : "Welcome back";

  return (
    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
      {greeting}, <span className="text-[var(--primary)]">{name}</span>
    </h1>
  );
}
