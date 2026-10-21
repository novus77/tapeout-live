import { expect, it } from "vitest";
import {
  medianGap,
  trendGapThreshold,
  trendPoints,
  trendSegments,
} from "./trendData";
const now = Date.parse("2026-10-18T12:00:00Z");
const points = (times: number[]) =>
  times.map((time) => ({ time, value: 1, raw: "1" }));
/** Builds a series from real gaps (in seconds), which trendSegments expects in ms. */
const fromGaps = (seconds: number[], start = 0) =>
  points(
    seconds.reduce<number[]>(
      (times, gap) => [...times, times.at(-1)! + gap * 1000],
      [start],
    ),
  );
const every = (count: number, step: number, start = 0) =>
  Array.from({ length: count }, (_, i) => start + i * step);
// Gaps actually observed in /v2/tapeout/charts hashrate.history on 2026-10-21.
const real24hGaps = [16125, 17473, 15583, 15363, 15659];
const real7dStep = 15913;
it("filters real timestamp windows without dropping zero or filling gaps", () => {
  const rows = [
    { time: now / 1000 - 100, value: "0" },
    { time: now / 1000 - 100000, value: "12" },
    { time: now / 1000 + 1, value: "1" },
    { time: now / 1000 - 50, value: null },
    { time: now / 1000 - 30, value: "-1" },
  ];
  expect(trendPoints(rows, "24h", now)).toEqual([
    { time: now - 100000, value: 0, raw: "0" },
  ]);
  expect(trendPoints(rows, "7d", now)).toHaveLength(2);
});
it("breaks long gaps and keeps single observations separate", () => {
  const sparse = [0, 60000, 24 * 3600000].map((time) => ({
    time,
    value: 1,
    raw: "1",
  }));
  expect(trendSegments(sparse, "24h").map((s) => s.length)).toEqual([2, 1]);
});
it("draws one line for the sparse 4.5h pre-sampled 24h series", () => {
  const sparse = fromGaps(real24hGaps);
  expect(medianGap(sparse)).toBe(15659000);
  // 3x the median (13h) would exceed the 6h ceiling of the 24h window.
  expect(trendGapThreshold(sparse, "24h")).toBe(6 * 3600000);
  expect(trendSegments(sparse, "24h").map((s) => s.length)).toEqual([6]);
});
it("draws one line for a dense per-minute series", () => {
  const dense = points(every(60, 60000));
  // Cadence is far below the historical 4h threshold, so the old behaviour holds.
  expect(trendGapThreshold(dense, "24h")).toBe(4 * 3600000);
  expect(trendSegments(dense, "24h").map((s) => s.length)).toEqual([60]);
});
it("keeps the real 7d sparse series continuous", () => {
  const sparse = points(every(38, real7dStep * 1000));
  expect(trendGapThreshold(sparse, "7d")).toBe(24 * 3600000);
  expect(trendSegments(sparse, "7d").map((s) => s.length)).toEqual([38]);
});
it("still breaks a real 2-day outage in the 7d window", () => {
  const gapped = points([
    ...every(10, real7dStep * 1000),
    ...every(10, real7dStep * 1000, 10 * real7dStep * 1000 + 2 * 86400000),
  ]);
  expect(trendSegments(gapped, "7d").map((s) => s.length)).toEqual([10, 10]);
});
it("still breaks a hole that hides a quarter of the 24h window", () => {
  // Sparse 4.5h cadence with a 7h hole: the ceiling, not the cadence, breaks it.
  const gapped = fromGaps([16125, 16125, 25200, ...real24hGaps.slice(1)]);
  expect(trendGapThreshold(gapped, "24h")).toBe(6 * 3600000);
  expect(trendSegments(gapped, "24h").map((s) => s.length)).toEqual([3, 5]);
});
