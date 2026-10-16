export type Row = Record<string, unknown>;
export function formatMetric(value: unknown, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(
        number,
      )
    : "—";
}
export function freshness(
  snapshot: unknown,
  interval: number,
  now = Date.now(),
): string {
  if (!snapshot || typeof snapshot !== "object") return "unavailable";
  const s = snapshot as {
    fetchedAt: number;
    observedAt?: string;
    stale: boolean;
  };
  if (s.stale || now - s.fetchedAt * 1000 > interval * 3000) return "stale";
  if (!s.observedAt || !Number.isFinite(Date.parse(s.observedAt)))
    return "unknown";
  return now - Date.parse(s.observedAt) > interval * 3000 ? "stale" : "fresh";
}
export function circuitTotals(
  rows: Row[],
  count: number,
): {
  optimal: number | null;
  verified: number | null;
  unverified: number | null;
} {
  const unavailable = { optimal: null, verified: null, unverified: null };
  // Group power semantics are not yet a documented contract. Only sum explicit individual rows.
  if (
    rows.length !== count ||
    rows.some(
      (r) =>
        Number(r.count ?? 1) !== 1 ||
        !["verified", "unverified"].includes(String(r.pool)) ||
        typeof r.current_hashrate !== "number" ||
        typeof r.is_champion !== "number",
    )
  )
    return unavailable;
  return rows.reduce<{ optimal: number; verified: number; unverified: number }>(
    (totals, r) => ({
      optimal: totals.optimal + (r.is_champion === 1 ? 1 : 0),
      verified:
        totals.verified +
        (r.pool === "verified" ? Number(r.current_hashrate) : 0),
      unverified:
        totals.unverified +
        (r.pool === "unverified" ? Number(r.current_hashrate) : 0),
    }),
    { optimal: 0, verified: 0, unverified: 0 },
  );
}
