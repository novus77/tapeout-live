export type TrendPoint = { time: number; value: number; raw: string };
export type TrendRange = "24h" | "7d";
const span: Record<TrendRange, number> = {
  "24h": 86400000,
  "7d": 604800000,
};
// v1 streamed a point per block; v2 serves a pre-sampled durable history whose
// cadence is roughly 4.5 hours and can change between releases. A fixed gap
// threshold therefore cannot separate "sparse sampling" from "missing data".
const minimum: Record<TrendRange, number> = {
  "24h": 4 * 3600000,
  "7d": 24 * 3600000,
};
// Sampling jitter up to 3x the observed median cadence still describes one
// continuous series; a larger gap is a candidate outage.
const jitter = 3;
// A candidate outage only becomes a visible break when it also hides at least a
// quarter of the visible window, so a lone missed sample never fakes a gap.
const outageShare = 0.25;
export function trendPoints(
  input: unknown,
  range: TrendRange,
  now = Date.now(),
): TrendPoint[] {
  const start = now - span[range];
  const byTime = new Map<number, TrendPoint>();
  for (const point of Array.isArray(input) ? input : []) {
    if (!point || typeof point !== "object") continue;
    const time = typeof point.time === "number" ? point.time * 1000 : NaN;
    const raw =
      typeof point.value === "number" ||
      (typeof point.value === "string" && /^\d+(\.\d+)?$/.test(point.value))
        ? String(point.value)
        : "";
    const value = raw === "" ? NaN : Number(raw);
    if (
      Number.isFinite(time) &&
      time >= start &&
      time <= now &&
      Number.isFinite(value) &&
      value >= 0
    )
      byTime.set(time, { time, value, raw });
  }
  const sorted = [...byTime.values()].sort((a, b) => a.time - b.time);
  const count = Math.min(sorted.length, 512);
  return Array.from(
    { length: count },
    (_, i) =>
      sorted[
        count <= 1 ? 0 : Math.floor((i * (sorted.length - 1)) / (count - 1))
      ],
  );
}
/** Median gap between consecutive ascending samples, or null below two points. */
export function medianGap(points: TrendPoint[]): number | null {
  const gaps: number[] = [];
  for (let index = 1; index < points.length; index++) {
    const gap = points[index].time - points[index - 1].time;
    if (gap > 0) gaps.push(gap);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const middle = gaps.length >> 1;
  return gaps.length % 2 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;
}
/**
 * Gap above which a line is broken. It follows the cadence actually observed in
 * these points (so a 4.5 hour pre-sampled series still draws one line), never
 * drops below the historical fixed threshold (dense series behave as before) and
 * never grows past a quarter of the window (a real outage still breaks).
 */
export function trendGapThreshold(
  points: TrendPoint[],
  range: TrendRange,
): number {
  const median = medianGap(points);
  if (median === null) return minimum[range];
  return Math.min(
    span[range] * outageShare,
    Math.max(minimum[range], median * jitter),
  );
}
export function trendSegments(
  points: TrendPoint[],
  range: TrendRange,
): TrendPoint[][] {
  const gap = trendGapThreshold(points, range);
  return points.reduce<TrendPoint[][]>((segments, point, index) => {
    if (!index || point.time - points[index - 1].time > gap) segments.push([]);
    segments.at(-1)!.push(point);
    return segments;
  }, []);
}
