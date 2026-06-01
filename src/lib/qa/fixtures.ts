/**
 * Deterministic test fixtures for the ATS and interview engine checks.
 *
 * Pure data only — no AI, no randomness. Each fixture carries its own expected
 * outcome so the checks can assert expected-vs-actual.
 */

import type { CvData } from "@/lib/cv/types";
import type { CodeRubric, TextRubric } from "@/lib/groq";

/** Build a minimal but valid CvData whose plain text contains `skills`+`summary`. */
function makeCv(summary: string, skills: string[]): CvData {
  return {
    contact: {
      name: "QA Fixture",
      title: "Software Engineer",
      email: "qa@example.com",
      phone: "",
      location: "",
      links: [],
    },
    summary,
    experience: [
      {
        title: "Software Engineer",
        company: "Acme",
        period: "2020 — 2024",
        link: "",
        description: summary,
        bullets: skills.slice(0, 4).map((s) => `Built features using ${s}.`),
      },
    ],
    projects: [],
    skills,
    education: [],
    certifications: [],
    languages: [],
  };
}

export interface AtsFixture {
  id: string;
  label: string;
  cv: CvData;
  jd: string;
  /** Inclusive expected score band [min, max]. */
  expected: [number, number];
}

const FRONTEND_SKILLS = [
  "React",
  "TypeScript",
  "JavaScript",
  "Redux",
  "Jest",
  "HTML",
  "CSS",
];
const BACKEND_PHP_SKILLS = ["PHP", "Laravel", "Symfony", "MySQL", "Composer"];
const MODERATE_JD = "React TypeScript JavaScript GraphQL AWS Docker Kubernetes";

export const ATS_FIXTURES: readonly AtsFixture[] = [
  {
    id: "perfect-match",
    label: "Resume fully matches the job description",
    // CV plain text includes every JD term → every keyword matches → ~100.
    cv: makeCv(
      "Senior engineer with React, TypeScript, JavaScript, Redux, Jest, HTML and CSS experience.",
      FRONTEND_SKILLS,
    ),
    jd: "We need React, TypeScript, JavaScript, Redux, Jest, HTML and CSS.",
    expected: [90, 100],
  },
  {
    id: "no-match",
    label: "Resume shares nothing with the job description",
    // Frontend CV vs a backend-PHP JD → near-zero overlap → < 30.
    cv: makeCv(
      "Frontend engineer focused on React, TypeScript and CSS.",
      FRONTEND_SKILLS,
    ),
    jd: "Backend role requiring PHP, Laravel, Symfony, MySQL and Composer.",
    expected: [0, 29],
  },
  {
    id: "partial-match",
    label: "Resume matches about half the job description",
    // Has React/TypeScript/JavaScript; missing GraphQL/AWS/Docker/Kubernetes.
    cv: makeCv(
      "Engineer with React, TypeScript and JavaScript.",
      ["React", "TypeScript", "JavaScript"],
    ),
    jd: MODERATE_JD,
    expected: [30, 80],
  },
];

export interface TextRubricFixture {
  id: string;
  label: string;
  rubric: TextRubric;
  expectedTotal: number;
}

export const TEXT_RUBRIC_FIXTURES: readonly TextRubricFixture[] = [
  {
    id: "text-strong",
    label: "Strong answer (max rubric)",
    rubric: {
      technicalAccuracy: 4,
      completeness: 3,
      communicationClarity: 2,
      interviewReadiness: 1,
    },
    expectedTotal: 10,
  },
  {
    id: "text-partial",
    label: "Partially correct answer",
    rubric: {
      technicalAccuracy: 2,
      completeness: 1,
      communicationClarity: 1,
      interviewReadiness: 0,
    },
    expectedTotal: 4,
  },
  {
    id: "text-weak",
    label: "Weak answer",
    rubric: {
      technicalAccuracy: 1,
      completeness: 0,
      communicationClarity: 0,
      interviewReadiness: 0,
    },
    expectedTotal: 1,
  },
];

export interface CodeRubricFixture {
  id: string;
  label: string;
  rubric: CodeRubric;
  expectedTotal: number;
}

export const CODE_RUBRIC_FIXTURES: readonly CodeRubricFixture[] = [
  {
    // 10*.4 + 9*.25 + 8*.2 + 9*.15 = 9.2 → round 9
    id: "code-strong",
    label: "Correct, idiomatic solution",
    rubric: { correctness: 10, approach: 9, edgeCases: 8, readability: 9 },
    expectedTotal: 9,
  },
  {
    // 2*.4 + 1*.25 + 1*.2 + 1*.15 = 1.4 → round 1
    id: "code-weak",
    label: "Mostly incorrect solution",
    rubric: { correctness: 2, approach: 1, edgeCases: 1, readability: 1 },
    expectedTotal: 1,
  },
];

/** Per-question scores used to validate session-total aggregation. */
export const AGGREGATION_FIXTURE = {
  perQuestion: [
    { score: 10, maxScore: 10 },
    { score: 4, maxScore: 10 },
    { score: 1, maxScore: 10 },
  ],
  expectedTotal: 15,
  expectedMax: 30,
};
