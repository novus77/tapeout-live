import { useState } from "react";
import { ArrowTopRightIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { command, rows, type Snapshot } from "./bridge";
import { formatMetric, type Row } from "./metrics";
import { Empty } from "./components";
export function Circuits({
  snapshot,
  full = false,
}: {
  snapshot: Snapshot | null;
  full?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const collection = rows(snapshot?.data.circuits);
  const sorted = collection
    .filter(
      (r) =>
        `${r.task_name} ${r.circuit_id} ${r.processor}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "all" ||
          filter === r.pool ||
          filter === r.processor ||
          filter === r.status ||
          (filter === "optimal" && r.is_champion === 1)),
    )
    .sort((a, b) => Number(b.current_hashrate) - Number(a.current_hashrate));
  if (!snapshot) return null;
  return (
    <section className="section">
      <div className="section-title">
        <h2>
          Mining circuits <span>{collection.length} groups</span>
        </h2>
        {!full && (
          <button
            className="text-button"
            onClick={() => void command("open_details")}
          >
            See all <ArrowTopRightIcon />
          </button>
        )}
      </div>
      {full && (
        <div className="filters">
          <label className="search">
            <MagnifyingGlassIcon />
            <input
              aria-label="Search circuits"
              placeholder="Search task, ID, processor"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Circuit filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "all",
              "optimal",
              "verified",
              "unverified",
              "active",
              "tapeout",
              "behemoth",
            ].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}
      {!sorted.length ? (
        <Empty title="No circuits found">
          No indexed circuits match this view.
        </Empty>
      ) : (
        <div className={full ? "circuit-list detailed" : "circuit-list"}>
          {sorted.slice(0, full ? 2000 : 5).map((r: Row, i) => (
            <article
              className="circuit-row"
              key={`${r.processor}:${r.circuit_id}:${i}`}
            >
              <div className="circuit-chip">
                {r.processor === "tapeout" ? "T" : "B"}
              </div>
              <div className="circuit-info">
                <strong>{String(r.task_name ?? "Unassigned task")}</strong>
                <span>
                  {String(r.processor ?? "Unknown")} #
                  {String(r.circuit_id ?? "—")} ·{" "}
                  {String(r.status ?? "unknown")}{" "}
                  {Number(r.count) > 1 ? `· ${r.count} circuits` : ""}
                </span>
                {full && (
                  <span>
                    {String(r.pool ?? "Unknown pool")} ·{" "}
                    {formatMetric(r.estimated_daily_bem)} BEM/day est. ·{" "}
                    {formatMetric(r.nand, 0)} N / {formatMetric(r.latch, 0)} L
                  </span>
                )}
              </div>
              <div className="circuit-value">
                <strong>
                  {formatMetric(r.current_hashrate, 0)} <small>H</small>
                </strong>
                <span className={r.is_champion === 1 ? "teal" : ""}>
                  {r.is_champion === 1 ? "Optimal" : "Base"}
                </span>
                {full && (
                  <span>
                    {formatMetric(r.firsto_market_value_bnb)} BNB est.
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
