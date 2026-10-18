export type TrendPoint = { time: number; value: number; raw: string };
export type TrendRange = "24h" | "7d";
export function trendPoints(
  input: unknown,
  range: TrendRange,
  now = Date.now(),
): TrendPoint[] {
  const start = now - (range === "24h" ? 86400000 : 604800000);
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
export function trendSegments(
  points: TrendPoint[],
  range: TrendRange,
): TrendPoint[][] {
  const gap = range === "24h" ? 4 * 3600000 : 24 * 3600000;
  return points.reduce<TrendPoint[][]>((segments, point, index) => {
    if (!index || point.time - points[index - 1].time > gap) segments.push([]);
    segments.at(-1)!.push(point);
    return segments;
  }, []);
}
