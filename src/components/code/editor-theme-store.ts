"use client";

import { useSyncExternalStore } from "react";
import { isValidTheme } from "./editor-themes";

export { EDITOR_THEMES } from "./editor-themes";

const KEY = "intervium.editorTheme";
const DEFAULT = "dojo-dark";

// The saved default lives in localStorage; an in-session pick is held in memory
// (applies live to every editor) until the user clicks "Set as default".
let sessionOverride: string | null = null;
const listeners = new Set<() => void>();

function readSavedDefault(): string {
  try {
    const v = window.localStorage.getItem(KEY);
    return v && isValidTheme(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function readEffective(): string {
  return sessionOverride ?? readSavedDefault();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function notify() {
  listeners.forEach((l) => l());
}

/** Apply a theme for this session only (live preview across all editors). */
export function setSessionTheme(id: string) {
  sessionOverride = isValidTheme(id) ? id : DEFAULT;
  notify();
}

/** Persist a theme as the user's default (this browser) and clear the override. */
export function saveDefaultTheme(id: string) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  sessionOverride = null;
  notify();
}

/** The theme currently shown (override, else saved default). */
export function useEditorTheme(): string {
  return useSyncExternalStore(subscribe, readEffective, () => DEFAULT);
}

/** The saved default — for "is the current theme already the default?" checks. */
export function useSavedDefaultTheme(): string {
  return useSyncExternalStore(subscribe, readSavedDefault, () => DEFAULT);
}
