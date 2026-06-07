/**
 * Unit tests for the infinite tier engine. Pure logic, no I/O.
 *
 * Run with: npm test   (uses Node's built-in test runner via tsx — no extra deps)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RANKS,
  RANKS_PER_CYCLE,
  thresholdForTier,
  tierFromPoints,
  toRoman,
} from "./progress-tiers";

test("zero points → first tier (Initiate · cycle 1)", () => {
  const t = tierFromPoints(0);
  assert.equal(t.tierIndex, 0);
  assert.equal(t.rankName, "Initiate");
  assert.equal(t.cycle, 1);
  assert.equal(t.currentThreshold, 0);
  assert.equal(t.nextThreshold, thresholdForTier(1));
  assert.equal(t.progressToNext, 0);
  assert.equal(t.ptsToNext, thresholdForTier(1));
});

test("non-finite / negative totals are treated as zero", () => {
  for (const bad of [-100, -1, Number.NaN, Number.NEGATIVE_INFINITY]) {
    const t = tierFromPoints(bad);
    assert.equal(t.tierIndex, 0, `${bad} should clamp to tier 0`);
    assert.equal(t.rankName, "Initiate");
  }
});

test("landing exactly on a threshold sits at that tier with 0 progress", () => {
  // Covers each rank boundary within the first two cycles.
  for (let k = 1; k <= RANKS_PER_CYCLE * 2; k++) {
    const at = thresholdForTier(k);
    const t = tierFromPoints(at);
    assert.equal(t.tierIndex, k, `points ${at} should be exactly tier ${k}`);
    assert.equal(t.progressToNext, 0);
    assert.equal(t.currentThreshold, at);
  }
});

test("one point below a threshold stays in the lower tier", () => {
  for (let k = 1; k <= RANKS_PER_CYCLE * 2; k++) {
    const justBelow = thresholdForTier(k) - 1;
    const t = tierFromPoints(justBelow);
    assert.equal(
      t.tierIndex,
      k - 1,
      `points ${justBelow} should be tier ${k - 1}`,
    );
    assert.equal(t.ptsToNext, 1);
    assert.ok(t.progressToNext > 0 && t.progressToNext < 1);
  }
});

test("RANKS has 8 entries and RANKS_PER_CYCLE matches", () => {
  assert.equal(RANKS.length, 8);
  assert.equal(RANKS_PER_CYCLE, 8);
});

test("rank names cycle and cycle counter advances every 8 tiers", () => {
  const expected: [number, string, number][] = [
    [0, "Initiate", 1],
    [1, "Aspirant", 1],
    [2, "Contender", 1],
    [3, "Strategist", 1],
    [4, "Sentinel", 1],
    [5, "Architect", 1],
    [6, "Virtuoso", 1],
    [7, "Sovereign", 1],
    [8, "Initiate", 2],
    [15, "Sovereign", 2],
    [16, "Initiate", 3],
    [23, "Sovereign", 3],
  ];
  for (const [idx, rank, cycle] of expected) {
    const t = tierFromPoints(thresholdForTier(idx));
    assert.equal(t.tierIndex, idx);
    assert.equal(t.rankName, rank);
    assert.equal(t.cycle, cycle);
  }
});

test("prestige rollover: Sovereign·I → Initiate·II as points cross the boundary", () => {
  const sov1 = tierFromPoints(thresholdForTier(7));
  assert.equal(sov1.rankName, "Sovereign");
  assert.equal(sov1.cycle, 1);

  const prestige = tierFromPoints(thresholdForTier(8));
  assert.equal(prestige.rankName, "Initiate");
  assert.equal(prestige.cycle, 2);
  assert.equal(prestige.tierIndex, 8);

  // One point shy of prestige is still Sovereign·I.
  const stillSov = tierFromPoints(thresholdForTier(8) - 1);
  assert.equal(stillSov.rankName, "Sovereign");
  assert.equal(stillSov.cycle, 1);
});

test("thresholds are strictly increasing and the gap widens (super-linear)", () => {
  let prevThreshold = thresholdForTier(0);
  let prevGap = 0;
  for (let k = 1; k <= 50; k++) {
    const cur = thresholdForTier(k);
    assert.ok(
      cur > prevThreshold,
      `threshold(${k}) must exceed threshold(${k - 1})`,
    );
    const gap = cur - prevThreshold;
    if (k >= 3) {
      assert.ok(
        gap > prevGap,
        `gap at tier ${k} should grow vs the previous gap`,
      );
    }
    prevGap = gap;
    prevThreshold = cur;
  }
});

test("progressToNext is ~0.5 halfway between two thresholds", () => {
  const lo = thresholdForTier(3);
  const hi = thresholdForTier(4);
  const mid = Math.floor((lo + hi) / 2);
  const t = tierFromPoints(mid);
  assert.equal(t.tierIndex, 3);
  assert.ok(Math.abs(t.progressToNext - 0.5) < 0.02);
});

test("very large totals resolve instantly and keep the tier invariant", () => {
  for (const total of [1_000_000, 1_000_000_000, 1e12, 1e15]) {
    const t = tierFromPoints(total);
    // The defining invariant: current ≤ total < next, and rank/cycle agree.
    assert.ok(thresholdForTier(t.tierIndex) <= total);
    assert.ok(total < thresholdForTier(t.tierIndex + 1));
    assert.equal(t.rankName, RANKS[t.tierIndex % RANKS_PER_CYCLE]);
    assert.equal(t.cycle, Math.floor(t.tierIndex / RANKS_PER_CYCLE) + 1);
    assert.ok(t.progressToNext >= 0 && t.progressToNext <= 1);
    assert.ok(t.ptsToNext > 0);
  }
});

test("toRoman covers cycles and falls back above 3999", () => {
  assert.equal(toRoman(1), "I");
  assert.equal(toRoman(2), "II");
  assert.equal(toRoman(4), "IV");
  assert.equal(toRoman(9), "IX");
  assert.equal(toRoman(14), "XIV");
  assert.equal(toRoman(40), "XL");
  assert.equal(toRoman(2026), "MMXXVI");
  assert.equal(toRoman(4000), "4000");
  assert.equal(toRoman(0), "I"); // defensive floor
});
