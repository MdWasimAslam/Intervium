import type { DojoRating } from "./types";

/**
 * SM-2 "lite" spaced-repetition scheduler (pure → unit-testable). `ease` is the
 * SM-2 ease factor ×100 (250 = 2.5) so it can live in an integer column. Wired
 * into the review flow in Phase 2; kept pure and standalone here.
 */
export interface SrState {
  ease: number;
  intervalDays: number;
}

export interface SrNext {
  ease: number;
  intervalDays: number;
  /** Days from now the card becomes due again. */
  dueInDays: number;
}

const MIN_EASE = 130;

export function schedule(prev: SrState, rating: DojoRating): SrNext {
  let ease = prev.ease;
  let interval = prev.intervalDays;

  switch (rating) {
    case "again":
      ease = Math.max(MIN_EASE, ease - 20);
      interval = 0; // resurfaces in the same session / next day
      break;
    case "hard":
      ease = Math.max(MIN_EASE, ease - 15);
      interval = Math.max(1, Math.round(interval * 1.2));
      break;
    case "good":
      interval = interval === 0 ? 1 : Math.round(interval * (ease / 100));
      break;
    case "easy":
      ease = ease + 15;
      interval =
        interval === 0 ? 3 : Math.round(interval * (ease / 100) * 1.3);
      break;
  }

  return { ease, intervalDays: interval, dueInDays: interval };
}
