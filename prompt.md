You are an expert technical interviewer and question-bank author. Generate
mock-interview questions for the "Intervium" app as STRICT JSON.

## OUTPUT FORMAT — match EXACTLY
Output ONLY a JSON array. No prose, no explanation, no markdown, no code
fences. The first character must be `[` and the last must be `]`.

Each array element is a "config block" with this exact shape:

[
  {
    "role": "Software Developer",
    "techStack": "React",
    "focusArea": "Frontend",
    "difficulty": "Senior",
    "interviewType": "technical",
    "questions": [
      { "questionText": "…", "idealAnswer": "…" },
      { "questionText": "…", "idealAnswer": "…" }
    ]
  }
]

## RULES
- Emit ONE block per unique combination of (techStack, focusArea, difficulty,
  interviewType) that is in scope below.
- Copy field values VERBATIM from the ALLOWED VALUES list (exact spelling/case).
- Put exactly the requested number of questions in each block's "questions".
- Every questionText must be unique, self-contained, and NOT numbered. Never
  reference a specific candidate, résumé/CV, person, or company.
- idealAnswer = the reference answer a rigorous interviewer expects: 3–6
  sentences, concrete, calibrated to the difficulty band. This is what an
  automated scorer grades real answers against, so make it genuinely correct
  and complete (mention key terms, tradeoffs, and pitfalls).
- Calibrate DIFFICULTY:
  - Junior  → fundamentals, definitions, "what/why" basics.
  - Mid     → practical application, common tradeoffs, debugging.
  - Senior  → design decisions, edge cases, performance, depth.
  - Lead    → architecture, scaling, cross-team/system tradeoffs, mentoring.
- Honor INTERVIEW TYPE:
  - technical  → tech-stack / focus-area concepts and problem-solving.
  - behavioral → past experience, collaboration, conflict, ownership (STAR
    style); NOT coding puzzles. You may lightly set the scene in the stack's
    world, but keep the question about behavior.
  - mixed      → a blend: some technical, some behavioral, within the block.
- Make questions meaningfully DIFFERENT from each other (vary sub-topic/angle).
- Valid JSON only: double quotes, escape any internal quotes and newlines, no
  trailing commas, no comments.

## ALLOWED VALUES (Software Developer)
- role:          "Software Developer"
- techStack:     "React", "React Native", "Node.js", "MongoDB", "Javascript"
- focusArea:     "General", "Frontend", "Backend"
- difficulty:    "Junior", "Mid", "Senior", "Lead"
- interviewType: "technical", "behavioral", "mixed"

## SCOPE FOR THIS REQUEST  ← EDIT THESE 5 LINES EACH RUN
- techStack:        React           (generate only this stack this run)
- focusArea:        ALL             (General, Frontend, Backend)
- difficulty:       ALL             (Junior, Mid, Senior, Lead)
- interviewType:    technical       (or: ALL = technical, behavioral, mixed)
- questions/block:  8

(With the example scope above: 3 focus × 4 difficulty × 1 type = 12 blocks ×
8 = 96 questions. To stay within one response, keep a run under ~150 questions
— narrow the scope, e.g. one techStack + one interviewType at a time, then
repeat the prompt for the next slice. Keep going until every
techStack × focusArea × difficulty × interviewType combination is covered.)

Begin the JSON output now.