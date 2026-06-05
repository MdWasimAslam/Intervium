/**
 * Back-compat barrel: the SM-2 scheduler now lives in `src/lib/spaced-repetition.ts`
 * so it can be shared across features. Dojo imports continue to work via this
 * re-export. `SrState`/`SrNext` are re-exported; `Rating` is aliased to the
 * Dojo-flavoured `DojoRating` (identical union) for existing call sites.
 */
export { schedule } from "@/lib/spaced-repetition";
export type { SrState, SrNext, Rating } from "@/lib/spaced-repetition";
