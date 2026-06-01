"use client";

import { useSyncExternalStore } from "react";
import { CV_DESIGNS, DEFAULT_DESIGN_ID } from "./designs";

/**
 * Shared store for the user's preferred (default) CV design, persisted in
 * localStorage so the on-screen preview, the dashboard PDF download, and the
 * job-tailored optimize download all render in the SAME template the user
 * chose. Read through useSyncExternalStore (no setState-in-effect) — SSR-safe
 * (the server snapshot is the built-in default), and it updates live across
 * every component the moment the default changes.
 */
export const DESIGN_STORAGE_KEY = "intervium.cvDesign";

const listeners = new Set<() => void>();

export function readPreferredDesignId(): string {
  const v = window.localStorage.getItem(DESIGN_STORAGE_KEY);
  return v && CV_DESIGNS.some((d) => d.id === v) ? v : DEFAULT_DESIGN_ID;
}

export function subscribeDesign(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function writePreferredDesignId(id: string) {
  window.localStorage.setItem(DESIGN_STORAGE_KEY, id);
  listeners.forEach((l) => l());
}

/** The saved default design id, falling back to {@link DEFAULT_DESIGN_ID} on the server. */
export function usePreferredDesignId(): string {
  return useSyncExternalStore(
    subscribeDesign,
    readPreferredDesignId,
    () => DEFAULT_DESIGN_ID,
  );
}
