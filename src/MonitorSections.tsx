import { useState } from "react";
import {
  accountProjects,
  object,
  rows,
  type Dashboard,
  type Snapshot,
} from "./bridge";
import {
  translator,
  locale,
  taskName,
  type Language,
  type Message,
} from "./i18n";
import { circuitTotals, formatMetric, freshness, type Row } from "./metrics";
import { Metric } from "./components";
import { FabNetwork } from "./FabNetwork";
import { SnapshotTime } from "./SnapshotTime";
import { Icon } from "./Icons";
import { AccountSelector } from "./AccountSelector";
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
        <h2 id="network-title">{t("network")}</h2>
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
  openSettings,
}: {
  data: Dashboard;
  select: (address: string) => Promise<void>;
  onError: (error: string) => void;
  disabled?: boolean;
  openSettings?: () => void;
}) {
  const { language, accounts, wallet, project } = data.settings,
    fab = project === "fab",
    t = translator(language),
    summary = object(data.address?.data.summary),
    assets = object(data.address?.data.assets),
    [copied, setCopied] = useState(false);
  const matchingAccounts = accounts.filter((account) =>
    accountProjects(account).includes(project),
  );
  const hasWallet = matchingAccounts.some(
    (account) => account.address === wallet,
  );
  const totals = circuitTotals(
    rows(data.address?.data.circuits),
    Number(summary.miner_count),
  );
  const assetTime =
    typeof assets.observed_at === "string" ? assets.observed_at : undefined;
  const balanceState = freshness(
    data.address ? { ...data.address, observedAt: assetTime } : null,
    data.settings.interval,
  );
  const balanceDetail = `${t("balanceAge")} · ${assetTime && Number.isFinite(Date.parse(assetTime)) ? new Date(assetTime).toLocaleString(locale(language)) : t("unknown")} · ${t(balanceState === "fresh" ? "fresh" : balanceState === "stale" ? "stale" : "unknown")}`;
  const tokenBalance = fab ? assets.token : assets.bem;
  const tokenDetail =
    fab && tokenBalance == null ? t("balanceUnavailable") : balanceDetail;
  const nativeDetail = fab ? t("balanceUnavailable") : balanceDetail;
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
        <h2 id="overview-title">{t("overview")}</h2>
        {matchingAccounts.length > 0 && (
          <AccountSelector
            accounts={matchingAccounts}
            wallet={wallet}
            language={language}
            disabled={disabled}
            select={select}
            onError={onError}
          />
        )}
      </div>
      {!hasWallet ? (
        <div className="empty">
          <h3>{t(accounts.length ? "noProjectAccount" : "noAccount")}</h3>
          <p>{t(accounts.length ? "noProjectAccountHelp" : "noAccountHelp")}</p>
          <button className="primary" onClick={openSettings}>
            {t("add")}
          </button>
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
              title={copied ? t("copied") : t("copy")}
              onClick={() => void copy()}
            >
              <Icon name="copy" />
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
              accent
            />
            <Metric title={t("miners")} value={summary.miner_count} />
            <Metric
              title={t("optimal")}
              value={fab ? summary.optimal : totals.optimal}
            />
          </div>
          <div className="balance-row">
            <span title={tokenDetail} aria-description={tokenDetail}>
              {t(fab ? "fabBalance" : "bemBalance")}{" "}
              <b>{formatMetric(tokenBalance, fab ? 8 : 4)}</b>
            </span>
            <span title={nativeDetail} aria-description={nativeDetail}>
              {t(fab ? "okbBalance" : "bnbBalance")}{" "}
              <b>{formatMetric(fab ? undefined : assets.bnb, 4)}</b>
            </span>
          </div>
        </>
      )}
    </section>
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
