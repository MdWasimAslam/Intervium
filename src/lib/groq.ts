/**
 * AI integration barrel.
 *
 * The implementation now lives in `src/lib/ai/*` (split out of this former
 * 1800-line god-module). This barrel re-exports everything so existing
 * `@/lib/groq` imports keep working unchanged.
 */
export * from "./ai/client";
export * from "./ai/interview";
export * from "./ai/cv";
export * from "./ai/skill-gap";
export * from "./ai/dojo";
