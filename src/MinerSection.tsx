import { useState } from "react";
import { rows, type Snapshot } from "./bridge";
import { translator, taskName, type Language } from "./i18n";
import { formatMetric } from "./metrics";
import { compareMetric, groupedMiner } from "./minerData";

export function MinerSection({
  snapshot,
  language,
}: {
  snapshot: Snapshot | null;
  language: Language;
}) {
  const t = translator(language),
    fab = snapshot?.resource === "fab_address";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("power");
  const source = rows(snapshot?.data.circuits);
  const collection = source
    .filter((row) =>
      [
        row.processor,
        row.task_name,
        row.task_id,
        row.circuit_id,
        ...(Array.isArray(row.circuit_ids) ? row.circuit_ids : []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "id") return compareMetric(a.circuit_id, b.circuit_id, true);
      const key =
        sort === "daily"
          ? fab
            ? "estimated_daily"
            : "estimated_daily_bem"
          : "current_hashrate";
      return compareMetric(
        groupedMiner(a) ? null : a[key],
        groupedMiner(b) ? null : b[key],
      );
    });
  const partial = snapshot?.data.circuitsComplete === false;
  const message = !snapshot
    ? "unavailable"
    : snapshot.data.pending === true
      ? "indexing"
      : source.length
        ? "noMatchingMiners"
        : "noCircuits";
  return (
    <section className="miner-section" aria-label={t("minerDetails")}>
      <div className="section-title">
        <h2>
          {t("minerDetails")}{" "}
          <span
            className="miner-coverage"
            title={t(partial ? "partialCircuits" : "loadedRecords")}
          >
            {!snapshot
              ? "—"
              : partial
                ? `${source.length} / ${formatMetric(snapshot?.data.circuitCount, 0)}`
                : `${source.length} ${t("records")}`}
          </span>
        </h2>
        <select
          aria-label={t("minerSorting")}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="power">{t("sortPower")}</option>
          <option value="daily">{t("sortDaily")}</option>
          <option value="id">{t("sortId")}</option>
        </select>
      </div>
      <input
        className="miner-search"
        aria-label={t("search")}
        placeholder={t("search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        className="miner-scroll"
        role="region"
        aria-label={t("minerDetails")}
        tabIndex={0}
      >
        {!collection.length ? (
          <p className="miner-empty" role="status">
            {t(message)}
          </p>
        ) : (
          collection.map((row, index) => {
            const group = groupedMiner(row);
            const state =
              row.status === "active"
                ? "active"
                : row.status === "inactive"
                  ? "inactive"
                  : row.status === "not_started"
                    ? "notStarted"
                    : "unknownState";
            const name = `${String(row.processor ?? "—")} #${String(row.circuit_id ?? "—")}`;
            return (
              <details
                className="miner-record"
                key={`${row.processor_address}:${row.circuit_id}:${index}`}
              >
                <summary>
                  <div className="miner-line">
                    <strong>{name}</strong>
                    <span
                      className={`miner-state ${state === "active" ? "active" : ""}`}
                    >
                      {t(state)}
                    </span>
                  </div>
                  <div className="miner-subline">
                    <span title={String(row.task_name ?? "")}>
                      {taskName(row, language)}
                    </span>
                    <span>
                      {group
                        ? t("groupedRecord")
                        : row.pool === "verified"
                          ? t("verifiedPool")
                          : row.pool === "unverified"
                            ? t("unverifiedPool")
                            : ""}
                    </span>
                  </div>
                  <div className="miner-values">
                    <b>
                      {formatMetric(group ? null : row.current_hashrate, 0)}
                      <small>H</small>
                    </b>
                    <b className="miner-daily" title={t("production")}>
                      <span>
                        {formatMetric(
                          group
                            ? null
                            : row[
                                fab ? "estimated_daily" : "estimated_daily_bem"
                              ],
                          fab ? 8 : 5,
                        )}
                      </span>
                      <small>
                        {fab ? "FAB" : "BEM"} / {t("perDay")}
                      </small>
                    </b>
                  </div>
                </summary>
                <dl className="miner-expanded">
                  <div>
                    <dt>{t("task")}</dt>
                    <dd>{String(row.task_id ?? "—")}</dd>
                  </div>
                  <div>
                    <dt>{t("processorAddress")}</dt>
                    <dd>
                      <code>{String(row.processor_address ?? "—")}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("optimal")}</dt>
                    <dd>
                      {row.is_champion === 1
                        ? t("yes")
                        : row.is_champion === 0
                          ? t("no")
                          : "—"}
                    </dd>
                  </div>
                  {group && (
                    <>
                      <div>
                        <dt>{t("groupCount")}</dt>
                        <dd>{formatMetric(row.count, 0)}</dd>
                      </div>
                      <div>
                        <dt>{t("circuitIds")}</dt>
                        <dd>
                          {Array.isArray(row.circuit_ids)
                            ? row.circuit_ids.map(String).join(", ")
                            : String(row.circuit_id ?? "—")}
                        </dd>
                      </div>
                      <div className="group-warning">
                        {t("groupMetricsUnavailable")}
                      </div>
                    </>
                  )}
                  {fab && (
                    <>
                      <div>
                        <dt>{t("verifiedWeight")}</dt>
                        <dd>{formatMetric(row.verified_weight, 0)}</dd>
                      </div>
                      <div>
                        <dt>{t("unverified")}</dt>
                        <dd>{formatMetric(row.unverified_weight, 0)}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}
