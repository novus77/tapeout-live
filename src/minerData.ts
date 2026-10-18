import { accountProjects, type Dashboard } from "./bridge";
import type { Row } from "./metrics";

function decimal(value: unknown): string | null {
  const text =
    typeof value === "number" && Number.isFinite(value)
      ? value.toLocaleString("en-US", {
          useGrouping: false,
          maximumFractionDigits: 20,
        })
      : typeof value === "string"
        ? value
        : "";
  return /^\d+(\.\d+)?$/.test(text) ? text : null;
}

// Missing values sort last; compare decimal strings without losing integer precision.
export function compareMetric(
  a: unknown,
  b: unknown,
  ascending = false,
): number {
  const left = decimal(a),
    right = decimal(b);
  if (left === null || right === null)
    return left === right ? 0 : left === null ? 1 : -1;
  const [aw, af = ""] = left.split("."),
    [bw, bf = ""] = right.split(".");
  const places = Math.max(af.length, bf.length);
  const av = BigInt(aw + af.padEnd(places, "0")),
    bv = BigInt(bw + bf.padEnd(places, "0"));
  return av === bv ? 0 : (av > bv ? -1 : 1) * (ascending ? -1 : 1);
}

export function groupedMiner(row: Row): boolean {
  return (
    Number(row.count ?? 1) !== 1 ||
    (Array.isArray(row.circuit_ids) && row.circuit_ids.length > 1)
  );
}

export function visibleMinerSnapshot(data: Dashboard) {
  const { wallet, project, accounts } = data.settings;
  const assigned = accounts.some(
    (a) => a.address === wallet && accountProjects(a).includes(project),
  );
  if (!wallet || !assigned) return null;
  const snapshot = data.address;
  if (
    !snapshot ||
    snapshot.resource !== (project === "fab" ? "fab_address" : "address") ||
    (snapshot.wallet && snapshot.wallet.toLowerCase() !== wallet.toLowerCase())
  )
    return null;
  return snapshot;
}
