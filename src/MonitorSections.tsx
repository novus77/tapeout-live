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
import { MinerSection } from "./MinerSection";
import { snapshotDetail } from "./SnapshotTime";
import { NetworkTrend } from "./NetworkTrend";
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
          snapshot={data.network}
          job={data.jobs.network}
          language={language}
          interval={interval}
        />
      </div>
      <div className="metric-grid compact">
        <Metric
          title={t("bemPrice")}
          value={market.bem_usd}
          unit="USD"
          detail={snapshotDetail(data.market, language, interval)}
        />
        <Metric
          title={t("networkPower")}
          value={network.total}
          unit="H"
          digits={0}
          detail={snapshotDetail(data.network, language, interval)}
        />
      </div>
      <div className="network-meta">
        <span>
          {t("verified")} <b>{formatMetric(market.verified_weight, 0)}</b>
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
        <span>
          {t("emission")} <b>{formatMetric(market.daily_emission, 0)}</b> BEM
        </span>
      </div>
      <NetworkTrend data={data} />
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
              job={data.jobs.address}
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
          </div>
          <div className="wallet-counts">
            <span>
              {t("miners")} <b>{formatMetric(summary.miner_count, 0)}</b>
            </span>
            <span>
              {t("optimal")}{" "}
              <b>{formatMetric(fab ? summary.optimal : totals.optimal, 0)}</b>
            </span>
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
  return (
    <MinerSection
      key={`${snapshot?.resource}:${snapshot?.wallet}`}
      snapshot={snapshot}
      language={language}
    />
  );
}
const activityEvents: Message[] = [
  "Start",
  "Demoted",
  "LeaderWin",
  "Transfer",
  "BEMSell",
  "BEMBuy",
  "BEMOut",
  "BEMTransfer",
  "BEMLiquidityAdd",
  "BEMLiquidityRemove",
  "BEMSwap",
  "BEMBurn",
  "BEMCollect",
  "Commit",
  "TapeOut",
  "Started",
  "TapedOut",
];
/** v2 token rows carry `kind`; circuit activity rows carry `event_type`. */
export const activityEvent = (row: Row) =>
  typeof row.event_type === "string" && row.event_type
    ? row.event_type
    : typeof row.kind === "string"
      ? row.kind
      : "";
/**
 * Identity keys of one on-chain event. The two sources describe the same event
 * with different columns: token rows expose block_number + transaction_index,
 * circuit activity rows expose block_number + log_index (several of which can
 * share one block), and both usually carry a tx hash. Returning every key lets
 * the merge collapse a duplicate even when the sources only overlap on one of
 * them.
 */
export const activityKeys = (row: Row): string[] => {
  const keys: string[] = [];
  if (row.operation_id != null && String(row.operation_id) !== "")
    keys.push(`operation:${String(row.operation_id)}`);
  const block = Number(row.block_number);
  if (Number.isFinite(block)) {
    const transaction = Number(row.transaction_index);
    if (row.transaction_index != null && Number.isFinite(transaction))
      keys.push(`block:${block}:transaction:${transaction}`);
    const log = Number(row.log_index);
    if (row.log_index != null && Number.isFinite(log))
      keys.push(`block:${block}:log:${log}`);
  }
  const hash = row.tx_hash;
  if (hash != null && String(hash) !== "") {
    const event = activityEvent(row);
    keys.push(`transaction:${String(hash).toLowerCase()}:${event}`);
  }
  return keys;
};
/** Primary key used for React reconciliation; every row gets a stable one. */
const activityKey = (row: Row, index: number) =>
  activityKeys(row)[0] ?? `index:${index}`;
const activitySource = (value: unknown) =>
  rows(Array.isArray(value) ? value : object(value).rows);
/**
 * Union of circuit activity and the v2 token/trade ledger folded into one
 * newest-first list. v2 serves token events from a separate endpoint, so a
 * wallet's BEM sales only reappear when both sources are merged.
 */
export function mergedActivity(...sources: unknown[]): Row[] {
  const seen = new Set<string>();
  const merged: Row[] = [];
  for (const source of sources)
    for (const row of activitySource(source)) {
      const keys = activityKeys(row);
      if (keys.some((key) => seen.has(key))) continue;
      for (const key of keys) seen.add(key);
      merged.push(row);
    }
  return merged
    .sort(
      (a, b) =>
        Number(b.block_number) - Number(a.block_number) ||
        Number(b.transaction_index ?? 0) - Number(a.transaction_index ?? 0) ||
        Number(b.log_index ?? 0) - Number(a.log_index ?? 0),
    )
    .slice(0, 5);
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
  const activity = mergedActivity(
    snapshot.data.activity,
    snapshot.data.tokenActivity,
  );
  const unavailable = snapshot.data.activityUnavailable === true,
    tokenUnavailable = snapshot.data.tokenActivityUnavailable === true;
  return (
    <section className="section">
      <div className="section-title">
        <h2>{t("activity")}</h2>
      </div>
      {unavailable && <p className="helper">{t("activityUnavailable")}</p>}
      {!unavailable && tokenUnavailable && (
        <p className="helper">{t("tokenActivityUnavailable")}</p>
      )}
      {activity.length ? (
        activity.map((row, i) => {
          const event = activityEvent(row);
          return (
            <article className="activity-row" key={activityKey(row, i)}>
              <span className="event-dot" />
              <div>
                <strong>
                  {t(
                    activityEvents.includes(event as Message)
                      ? (event as Message)
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
          );
        })
      ) : (
        <p className="helper">
          {t(
            snapshot.data.pending === true
              ? "indexing"
              : unavailable || tokenUnavailable
                ? "activityUnavailable"
                : "noActivity",
          )}
        </p>
      )}
    </section>
  );
}
