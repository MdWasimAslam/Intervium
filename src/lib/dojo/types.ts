import type { TestCase } from "@/components/code/types";

export type DojoDifficulty = "easy" | "medium" | "hard";
export type DojoRating = "again" | "hard" | "good" | "easy";

export interface DojoTopicRef {
  slug: string;
  name: string;
}

/** Row shape for the question list/viewer. */
export interface DojoListItem {
  slug: string;
  title: string;
  difficulty: DojoDifficulty;
  topics: DojoTopicRef[];
  solved: boolean;
  attempted: boolean;
  /** True when this is the current user's own (personal) problem. */
  isMine: boolean;
}

/** Everything the solve view needs for one question. */
export interface DojoQuestionDetail {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  difficulty: DojoDifficulty;
  starterCode: string;
  fnName: string;
  testCases: TestCase[];
  topics: DojoTopicRef[];
  solved: boolean;
  /** True when this is the current user's own (personal) problem. */
  isMine: boolean;
  /** The user's most recent submission, restored into the editor (else starter). */
  lastAttemptCode: string | null;
}

/** Aggregate practice stats for the Dojo stats strip. */
export interface DojoStats {
  solvedTotal: number;
  byDifficulty: Record<DojoDifficulty, number>;
  solvedThisWeek: number;
}
