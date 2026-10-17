import {
  CopyIcon,
  CheckIcon,
  GlobeIcon,
  LightningBoltIcon,
  CubeIcon,
  ActivityLogIcon,
} from "@radix-ui/react-icons";
import { useState } from "react";
import { object, rows, type Dashboard, type Snapshot } from "./bridge";
import {
  translator,
  locale,
  taskName,
  type Language,
  type Message,
} from "./i18n";
import { circuitTotals, formatMetric, type Row } from "./metrics";
import { Metric, Sparkline } from "./components";
import { FabNetwork } from "./FabNetwork";
import { SnapshotTime } from "./SnapshotTime";
export function NetworkSection({ data }: { data: Dashboard }) {
  const { language, interval } = data.settings,
    t = translator(language),
    market = object(data.market?.data.market),
    network = object(data.network?.data.hashrate),
    pools = rows(network.snapshot);
  if (data.settings.project === "fab") return <FabNetwork data={data} />;
  return (
    <section className="network-section" aria-labelledby="network-title">
      <div className="section-title">
        <h2 id="network-title">
          <GlobeIcon />
          {t("network")}
        </h2>
        <SnapshotTime
          snapshot={data.market}
          language={language}
          interval={interval}
        />
      </div>
      <div className="metric-grid compact">
        <Metric title={t("bemPrice")} value={market.bem_usd} unit="USD" />
        <Metric title={t("networkPower")} value={network.total} unit="H" />
        <Metric title={t("verifiedWeight")} value={market.verified_weight} />
        <Metric
          title={t("emission")}
          value={market.daily_emission}
          unit="BEM"
        />
      </div>
      <div className="network-meta">
        <span>
          {t("unverified")} {t("weight")}{" "}
          <b>{formatMetric(market.unverified_weight, 0)}</b>
        </span>
        <span>
          {t("snapshotCount")}{" "}
          <b>
            {pools.length
              ? pools
                  .reduce((sum, p) => sum + Number(p.miners ?? 0), 0)
                  .toLocaleString(locale(language))
              : "—"}
          </b>
        </span>
      </div>
      <div className="material-strip" aria-label={t("materials")}>
        <span>
          BNB <b>${formatMetric(market.bnb_usd)}</b>
        </span>
        {(
          [
            ["T · N", "tapeout_nand_bnb"],
            ["T · L", "tapeout_latch_bnb"],
            ["B · N", "behemoth_nand_bnb"],
            ["B · L", "behemoth_latch_bnb"],
          ] as const
        ).map(([label, key]) => (
          <span key={key} title={`${t("materials")} · ${key} · BNB`}>
            {label} <b>{formatMetric(market[key], 4)}</b>
            {object(object(market.transistorQuotes)[key]).stale === true && (
              <em>{t("stale")}</em>
            )}
          </span>
        ))}
      </div>
      <div className="source-note">
        {t("networkPower")} ·{" "}
        <SnapshotTime
          snapshot={data.network}
          language={language}
          interval={900}
        />
      </div>
    </section>
  );
}
export function WalletSection({
  data,
  select,
  onError,
  disabled = false,
}: {
  data: Dashboard;
  select: (address: string) => Promise<void>;
  onError: (error: string) => void;
  disabled?: boolean;
}) {
  const { language, accounts, wallet, project } = data.settings,
    fab = project === "fab",
    t = translator(language),
    summary = object(data.address?.data.summary),
    assets = object(data.address?.data.assets),
    [copied, setCopied] = useState(false);
  const totals = circuitTotals(
    rows(data.address?.data.circuits),
    Number(summary.miner_count),
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      onError(String(e));
    }
  }
  return (
    <section className="wallet-section" aria-labelledby="overview-title">
      <div className="section-title">
        <h2 id="overview-title">
          <LightningBoltIcon />
          {t("overview")}
        </h2>
        {accounts.length > 0 && (
          <select
            className="account-selector"
            aria-label={t("choose")}
            value={wallet}
            disabled={disabled}
            onChange={(e) =>
              void select(e.target.value).catch((e) => onError(String(e)))
            }
          >
            {accounts.map((a, i) => (
              <option key={a.address} value={a.address}>
                {a.name || `${t("account")} ${i + 1}`} · {a.address.slice(0, 6)}
                …{a.address.slice(-4)}
              </option>
            ))}
          </select>
        )}
      </div>
      {!wallet ? (
        <div className="empty">
          <h3>{t("noAccount")}</h3>
          <p>{t("noAccountHelp")}</p>
        </div>
      ) : (
        <>
          <div className="address-row">
            <code title={wallet}>
              {wallet.slice(0, 10)}…{wallet.slice(-8)}
            </code>
            <button
              className="icon-button"
              aria-label={copied ? t("copied") : t("copy")}
              onClick={() => void copy()}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
            <SnapshotTime
              snapshot={data.address}
              language={language}
              interval={data.settings.interval}
            />
          </div>
          <div className="metric-grid">
            <Metric
              title={t("power")}
              value={summary.total_hashrate}
              unit="H"
              icon={<LightningBoltIcon />}
              accent
            />
            <Metric
              title={t("production")}
              value={
                fab
                  ? summary.estimated_daily
                  : summary.total_estimated_daily_bem
              }
              unit={fab ? "FAB" : "BEM"}
              digits={fab ? 8 : 2}
              note={t("estimate")}
              icon={<ActivityLogIcon />}
              accent
            />
            <Metric
              title={t("miners")}
              value={summary.miner_count}
              icon={<CubeIcon />}
            />
            <Metric
              title={t("optimal")}
              value={fab ? summary.optimal : totals.optimal}
            />
          </div>
          {fab ? (
            <div className="split-labels">
              <span>
                {t("running")} <b>{formatMetric(summary.active, 0)}</b>
              </span>
            </div>
          ) : (
            <div className="split-labels">
              <span>
                {t("verified")} <b>{formatMetric(totals.verified, 0)} H</b>
              </span>
              <span>
                {t("unverified")} <b>{formatMetric(totals.unverified, 0)} H</b>
              </span>
            </div>
          )}
          <div className="balance-row">
            <span>
              {t(fab ? "fabBalance" : "bemBalance")}{" "}
              <b>
                {formatMetric(fab ? assets.token : assets.bem, fab ? 8 : 4)}
              </b>
            </span>
            {!fab && (
              <span>
                {t("bnbBalance")} <b>{formatMetric(assets.bnb, 4)}</b>
              </span>
            )}
          </div>
          {fab && <PowerHistory snapshot={data.address} language={language} />}
          <div className="source-note">
            {t("balanceAge")} ·{" "}
            {assets.observed_at
              ? new Date(String(assets.observed_at)).toLocaleString(
                  locale(language),
                )
              : t("unavailable")}
            {assets.observed_at &&
            Date.now() - Date.parse(String(assets.observed_at)) >
              data.settings.interval * 3000
              ? ` · ${t("stale")}`
              : ""}
          </div>
        </>
      )}
    </section>
  );
}
function PowerHistory({
  snapshot,
  language,
}: {
  snapshot: Snapshot | null;
  language: Language;
}) {
  const t = translator(language),
    points = rows(object(snapshot?.data.hashrateHistory).points);
  const values = points
    .filter((p) =>
      typeof p.weight === "number"
        ? Number.isFinite(p.weight) && p.weight >= 0
        : typeof p.weight === "string" && /^\d+(\.\d+)?$/.test(p.weight),
    )
    .map((p) => Number(p.weight))
    .filter(Number.isFinite);
  if (values.length < 2) return null;
  return (
    <div className="power-history">
      <span className="helper">{t("powerHistory")}</span>
      <Sparkline values={values} label={t("powerHistory")} />
    </div>
  );
}
export function CircuitSection({
  snapshot,
  language,
}: {
  snapshot: Snapshot | null;
  language: Language;
}) {
  const [query, setQuery] = useState(""),
    t = translator(language);
  if (!snapshot) return null;
  const collection = rows(snapshot.data.circuits)
    .filter((r) =>
      `${r.task_name} ${r.task_id} ${r.circuit_id} ${r.processor}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => Number(b.current_hashrate) - Number(a.current_hashrate));
  return (
    <section className="section">
      <div className="section-title">
        <h2>{t("circuits")}</h2>
        <span className="muted">
          {collection.length} {t("groups")}
        </span>
      </div>
      {snapshot.data.circuitsComplete === false && (
        <p className="helper">
          {t("partialCircuits")}: {rows(snapshot.data.circuits).length} /{" "}
          {formatMetric(snapshot.data.circuitCount, 0)}
        </p>
      )}
      <input
        className="circuit-search"
        aria-label={t("search")}
        placeholder={t("search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!collection.length ? (
        <p className="helper">
          {t(snapshot.data.pending === true ? "indexing" : "noCircuits")}
        </p>
      ) : (
        collection.map((row: Row, i) => (
          <article
            className="circuit-row"
            key={`${row.processor}:${row.circuit_id}:${i}`}
          >
            <span className="circuit-chip">
              {snapshot.resource === "fab_address"
                ? "F"
                : row.processor === "tapeout"
                  ? "T"
                  : "B"}
            </span>
            <div className="circuit-info">
              <strong title={String(row.task_name ?? "")}>
                {taskName(row, language)}
              </strong>
              <span>
                {String(row.processor ?? "—")} #{String(row.circuit_id ?? "—")}{" "}
                ·{" "}
                {row.status === "active"
                  ? t("active")
                  : row.status === "inactive"
                    ? t("inactive")
                    : row.status === "not_started"
                      ? t("notStarted")
                      : t("unknownState")}
                {Number(row.count) > 1 ? ` · ${row.count}` : ""}
              </span>
            </div>
            <div className="circuit-value">
              <strong>{formatMetric(row.current_hashrate, 0)} H</strong>
              <span className={row.is_champion === 1 ? "teal" : ""}>
                {row.is_champion === 1 ? t("optimal") : t("base")}
              </span>
              {snapshot.resource === "fab_address" && (
                <span>
                  {formatMetric(row.estimated_daily, 8)} FAB/
                  {language === "zh" ? "日" : "day"}
                </span>
              )}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
export function ActivitySection({
  snapshot,
  language,
}: {
  snapshot: Snapshot | null;
  language: Language;
}) {
  const t = translator(language);
  if (!snapshot) return null;
  const activity = rows(object(snapshot.data.activity).rows)
    .slice()
    .sort(
      (a, b) =>
        Number(b.block_number) - Number(a.block_number) ||
        Number(b.transaction_index ?? 0) - Number(a.transaction_index ?? 0) ||
        Number(b.log_index ?? 0) - Number(a.log_index ?? 0),
    )
    .slice(0, 5);
  const events: Message[] = [
    "Start",
    "Demoted",
    "LeaderWin",
    "Transfer",
    "BEMSell",
    "BEMBuy",
    "Commit",
  ];
  return (
    <section className="section">
      <div className="section-title">
        <h2>{t("activity")}</h2>
      </div>
      {snapshot.data.activityUnavailable === true && (
        <p className="helper">{t("activityUnavailable")}</p>
      )}
      {activity.length ? (
        activity.map((row, i) => (
          <article className="activity-row" key={String(row.operation_id ?? i)}>
            <span className="event-dot" />
            <div>
              <strong>
                {t(
                  events.includes(row.event_type as Message)
                    ? (row.event_type as Message)
                    : "unknownEvent",
                )}
              </strong>
              <p>
                {row.task_id
                  ? taskName(row, language)
                  : `#${formatMetric(row.block_number, 0)}`}
              </p>
            </div>
            <time>
              {row.block_time
                ? new Date(String(row.block_time)).toLocaleTimeString(
                    locale(language),
                    { hour: "2-digit", minute: "2-digit" },
                  )
                : "—"}
            </time>
          </article>
        ))
      ) : (
        <p className="helper">
          {t(snapshot.data.pending === true ? "indexing" : "noActivity")}
        </p>
      )}
    </section>
  );
}
