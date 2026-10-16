import { useCallback, useEffect, useState } from "react";
import {
  ActivityLogIcon,
  ArrowTopRightIcon,
  CopyIcon,
  DashboardIcon,
  GearIcon,
  GlobeIcon,
  LightningBoltIcon,
  PinLeftIcon,
  ReloadIcon,
  ExitIcon,
  CubeIcon,
  CheckCircledIcon,
  TokensIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import {
  command,
  defaults,
  native,
  object,
  onSnapshot,
  rows,
  type Dashboard,
} from "./bridge";
import { circuitTotals, formatMetric, freshness } from "./metrics";
import { Empty, Metric } from "./components";
import { Circuits } from "./Circuits";
import { SettingsForm } from "./Settings";
type Tab = "overview" | "network" | "activity" | "settings";
const initial: Dashboard = {
  settings: defaults,
  address: null,
  market: null,
  network: null,
  jobs: {},
};
export default function App() {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState<Tab>("overview"),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [priceHistory, setPriceHistory] = useState<number[]>([]);
  const details = new URLSearchParams(window.location.search).has("details");
  const load = useCallback(async () => {
    try {
      setData(await command<Dashboard>("get_dashboard"));
      setError("");
      const history = await command<{ value: string }[]>("get_history", {
        resource: "market",
        metric: "bem",
      });
      setPriceHistory(history.map((r) => Number(r.value)));
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    void load();
    let alive = true;
    let cleanup: (() => void) | undefined;
    void onSnapshot(() => void load()).then((fn) => {
      if (alive) cleanup = fn;
      else fn();
    });
    return () => {
      alive = false;
      cleanup?.();
    };
  }, [load]);
  useEffect(() => {
    void command("set_network_visible", { visible: tab === "network" });
    return () => {
      void command("set_network_visible", { visible: false });
    };
  }, [tab]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !details) void command("hide_panel");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [details]);
  useEffect(() => {
    if (!native) return;
    const handler = () => {
      void command("set_network_visible", {
        visible: document.hasFocus() && tab === "network",
      });
    };
    window.addEventListener("focus", handler);
    window.addEventListener("blur", handler);
    return () => {
      window.removeEventListener("focus", handler);
      window.removeEventListener("blur", handler);
    };
  }, [tab]);
  const summary = object(data.address?.data.summary),
    assets = object(data.address?.data.assets),
    market = object(data.market?.data.market),
    network = object(data.network?.data.hashrate);
  const totals = circuitTotals(
    rows(data.address?.data.circuits),
    Number(summary.miner_count),
  );
  const state = freshness(data.address ?? data.market, data.settings.interval);
  const stateLabels: Record<string, string> = {
    fresh: "Up to date",
    stale: "Delayed data",
    unknown: "Source age unknown",
    unavailable: "Waiting for data",
  };
  const history = rows(object(data.address?.data.hashrateHistory).points).map(
    (p) => Number(p.total),
  );
  const busy = Object.values(data.jobs).some((j) => j.busy);
  const refresh = async () => {
    setError("");
    try {
      await Promise.all(
        (tab === "network" ? ["market", "network"] : ["address", "market"]).map(
          (resource) => command("refresh_resource", { resource }),
        ),
      );
    } catch (e) {
      setError(String(e));
    }
  };
  async function copy() {
    try {
      await navigator.clipboard.writeText(data.settings.wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard is unavailable. Copy your address from Settings.");
    }
  }
  if (details)
    return (
      <div className="details-page">
        <header>
          <div className="brand">
            <CubeIcon />
            <span>
              TapeOut <b>Live</b>
            </span>
          </div>
          <span className="muted">
            {data.settings.alias || "My wallet"} ·{" "}
            {data.settings.wallet.slice(0, 8)}…
          </span>
        </header>
        <Circuits snapshot={data.address} full />
      </div>
    );
  return (
    <div className="panel">
      <header className="header">
        <div className="brand-row">
          <div className="brand">
            <span className="logo">
              <CubeIcon />
            </span>
            <span>
              TapeOut <b>Live</b>
            </span>
            <span className="tag">BSC</span>
          </div>
          <button
            className="icon-button"
            aria-label="Settings"
            onClick={() => setTab(tab === "settings" ? "overview" : "settings")}
          >
            <GearIcon />
          </button>
        </div>
        <div className="wallet-row">
          <div>
            <span className="eyebrow">
              {data.settings.alias || "MY MINING WALLET"}
            </span>
            <button className="wallet" onClick={() => setTab("settings")}>
              {data.settings.wallet
                ? `${data.settings.wallet.slice(0, 8)}…${data.settings.wallet.slice(-6)}`
                : "Add your wallet"}
            </button>
          </div>
          {data.settings.wallet && (
            <button
              aria-label="Copy wallet address"
              className="icon-button"
              onClick={() => void copy()}
            >
              {copied ? <CheckCircledIcon /> : <CopyIcon />}
            </button>
          )}
        </div>
        <div className="sync-row">
          <span className={`sync ${state}`}>
            <i />
            {busy ? "Syncing…" : stateLabels[state]}
          </span>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <ReloadIcon />
            {busy ? "Refreshing" : "Refresh"}
          </button>
        </div>
        <nav aria-label="Monitor views">
          {(
            [
              ["overview", "Overview", DashboardIcon],
              ["network", "Network", GlobeIcon],
              ["activity", "Activity", ActivityLogIcon],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              aria-current={tab === key ? "page" : undefined}
              className={tab === key ? "selected" : ""}
              onClick={() => setTab(key)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {!native && (
          <div className="notice">
            Layout preview · Open the desktop app for live data.
          </div>
        )}
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        {Object.entries(data.jobs)
          .filter(
            ([resource, j]) =>
              j.error && (resource !== "network" || tab === "network"),
          )
          .map(([resource, j]) => (
            <div className="notice warning" key={resource}>
              <strong>{resource} update unavailable</strong>
              <p>{j.error}</p>
              <small>
                {j.terminal
                  ? "Provider compatibility check required."
                  : `Retry after ${new Date(j.nextAt * 1000).toLocaleTimeString()}. Cached data is retained.`}
              </small>
            </div>
          ))}
        {tab === "settings" ? (
          <SettingsForm
            key={data.settings.wallet}
            settings={data.settings}
            onSaved={() => {
              void load();
              setTab("overview");
            }}
          />
        ) : tab === "overview" ? (
          <>
            {!data.settings.wallet ? (
              <Empty title="Your mining, at a glance">
                Add a public wallet address to see your circuits, mining power,
                and estimated production.
                <button className="primary" onClick={() => setTab("settings")}>
                  Add wallet address
                </button>
              </Empty>
            ) : !data.address ? (
              <div className="metric-grid" aria-label="Loading wallet data">
                {[
                  "Mining power",
                  "Estimated / day",
                  "Mining circuits",
                  "Optimal circuits",
                  "BEM balance",
                  "BNB balance",
                ].map((title) => (
                  <Metric
                    key={title}
                    title={title}
                    value={null}
                    note={
                      data.jobs.address?.busy ? "Loading…" : "Awaiting provider"
                    }
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="metric-grid">
                  <Metric
                    title="Mining power"
                    value={summary.total_hashrate}
                    unit="H"
                    icon={<LightningBoltIcon />}
                    values={history}
                    accent
                  />
                  <Metric
                    title="Estimated / day"
                    value={summary.total_estimated_daily_bem}
                    unit="BEM"
                    icon={<ActivityLogIcon />}
                    note="Production estimate"
                    accent
                  />
                  <Metric
                    title="Mining circuits"
                    value={summary.miner_count}
                    icon={<CubeIcon />}
                    note={`${formatMetric(summary.group_count, 0)} indexed groups`}
                  />
                  <Metric
                    title="Optimal circuits"
                    value={totals.optimal}
                    icon={<CheckCircledIcon />}
                    note={
                      totals.optimal === null
                        ? "Breakdown unavailable"
                        : "Current champion positions"
                    }
                  />
                  <Metric
                    title="BEM balance"
                    value={assets.bem}
                    unit="BEM"
                    icon={<TokensIcon />}
                    note={
                      assets.observed_at
                        ? `As of ${new Date(String(assets.observed_at)).toLocaleTimeString()}`
                        : "Asset snapshot unavailable"
                    }
                  />
                  <Metric
                    title="BNB balance"
                    value={assets.bnb}
                    unit="BNB"
                    icon={<TokensIcon />}
                    note="Wallet balance"
                  />
                </div>
                <section className="power-breakdown">
                  <div className="section-title">
                    <h2>Mining power split</h2>
                    <span className="tag">On-chain</span>
                  </div>
                  <div className="split-labels">
                    <span>
                      <i />
                      Verified <b>{formatMetric(totals.verified, 0)} H</b>
                    </span>
                    <span>
                      Unverified <b>{formatMetric(totals.unverified, 0)} H</b>
                    </span>
                  </div>
                  <div className="bar">
                    <span
                      style={{
                        width:
                          totals.verified === null
                            ? "0%"
                            : `${(totals.verified / Math.max(1, totals.verified + (totals.unverified ?? 0))) * 100}%`,
                      }}
                    />
                  </div>
                </section>
              </>
            )}
            <section className="network-strip">
              <div className="section-title">
                <h2>
                  <GlobeIcon /> Network pulse
                </h2>
                <button
                  className="text-button"
                  onClick={() => setTab("network")}
                >
                  Explore <ArrowTopRightIcon />
                </button>
              </div>
              <div className="strip-values">
                <div>
                  <span>BEM price</span>
                  <b>${formatMetric(market.bem_usd)}</b>
                </div>
                <div>
                  <span>Verified weight</span>
                  <b>{formatMetric(market.verified_weight, 0)}</b>
                </div>
              </div>
            </section>
            <Circuits snapshot={data.address} />
            {data.address && (
              <section className="valuation">
                <div className="section-title">
                  <h2>Model estimates</h2>
                  <span className="tag amber">Estimated</span>
                </div>
                <dl>
                  <div>
                    <dt>Material cost at current prices</dt>
                    <dd>{formatMetric(summary.total_manufacturing_bnb)} BNB</dd>
                  </div>
                  <div>
                    <dt>Market value model</dt>
                    <dd>
                      {formatMetric(summary.total_firsto_market_value_bnb)} BNB
                    </dd>
                  </div>
                  <div>
                    <dt>Model payback</dt>
                    <dd>
                      {formatMetric(summary.manufacturing_payback_days, 1)} days
                    </dd>
                  </div>
                </dl>
                <p className="helper">
                  Model values are not historical spending or guaranteed
                  proceeds.
                </p>
              </section>
            )}
          </>
        ) : tab === "network" ? (
          <>
            <div className="section-title">
              <h2>Whole network</h2>
              <span className="tag">TapeOutScan</span>
            </div>
            <div className="metric-grid">
              <Metric
                title="BEM price"
                value={market.bem_usd}
                unit="USD"
                values={priceHistory}
                accent
              />
              <Metric
                title="BNB price"
                value={market.bnb_usd}
                unit="USD"
                accent
              />
              <Metric title="Verified weight" value={market.verified_weight} />
              <Metric
                title="Unverified weight"
                value={market.unverified_weight}
              />
              <Metric
                title="Daily emission"
                value={market.daily_emission}
                unit="BEM"
                note="Provider schedule"
              />
              <Metric
                title="Network power"
                value={network.total}
                unit="H"
                note={
                  data.network
                    ? `As of ${new Date(data.network.fetchedAt * 1000).toLocaleTimeString()}`
                    : "Loads on demand"
                }
              />
            </div>
            <section className="section">
              <div className="section-title">
                <h2>Indexed mining snapshot</h2>
                <span className="tag">15 min refresh</span>
              </div>
              {rows(network.snapshot).length ? (
                <dl>
                  {rows(network.snapshot).map((r, i) => (
                    <div key={i}>
                      <dt>
                        {String(r.processor)} · {String(r.pool)}
                      </dt>
                      <dd>
                        {formatMetric(r.miners, 0)} circuits ·{" "}
                        {formatMetric(r.hashrate, 0)} H
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="helper">
                  {data.jobs.network?.busy
                    ? "Loading full network statistics…"
                    : "Network statistics are collected while this view is open."}
                </p>
              )}
            </section>
            <section className="section">
              <div className="section-title">
                <h2>Material prices</h2>
                <span className="tag">BNB</span>
              </div>
              <dl>
                {[
                  ["TapeOut NAND", "tapeout_nand_bnb"],
                  ["TapeOut LATCH", "tapeout_latch_bnb"],
                  ["Behemoth NAND", "behemoth_nand_bnb"],
                  ["Behemoth LATCH", "behemoth_latch_bnb"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>
                      {formatMetric(market[key], 6)}{" "}
                      {object(object(market.transistorQuotes)[key]).stale ===
                        true && <span className="amber">Delayed</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="source-note">
              Market observed{" "}
              {market.observed_at
                ? new Date(String(market.observed_at)).toLocaleString()
                : "—"}{" "}
              · {freshness(data.market, data.settings.interval)}
            </div>
          </>
        ) : (
          <section className="section">
            <div className="section-title">
              <h2>Recent wallet activity</h2>
              <span className="tag">Indexed</span>
            </div>
            {rows(object(data.address?.data.activity).rows).length ? (
              rows(object(data.address?.data.activity).rows)
                .slice()
                .sort(
                  (a, b) =>
                    Number(b.block_number) - Number(a.block_number) ||
                    Number(b.log_index) - Number(a.log_index),
                )
                .slice(0, 20)
                .map((r, i) => (
                  <article
                    className="activity-row"
                    key={String(r.operation_id ?? i)}
                  >
                    <div className="event-dot" />
                    <div>
                      <strong>{String(r.event_type ?? "Unknown event")}</strong>
                      <p>
                        {String(
                          r.task_name ??
                            (r.task_id
                              ? `Task #${r.task_id}`
                              : "Wallet operation"),
                        )}
                      </p>
                      <small>
                        {r.block_time
                          ? new Date(String(r.block_time)).toLocaleString()
                          : "Time unavailable"}
                      </small>
                    </div>
                    <span className="event-block">
                      #{formatMetric(r.block_number, 0)}
                    </span>
                  </article>
                ))
            ) : (
              <Empty title="No recent activity">
                Indexed address events will appear here after a wallet is
                configured.
              </Empty>
            )}
          </section>
        )}
        {data.address && tab === "overview" && (
          <div className="source-note">
            Source observation{" "}
            {data.address.observedAt
              ? new Date(data.address.observedAt).toLocaleString()
              : "unknown"}{" "}
            · Block #{formatMetric(data.address.observedBlock, 0)}
          </div>
        )}
      </main>
      <footer>
        <button
          className="text-button"
          onClick={() =>
            void command("open_scan").catch((e) => setError(String(e)))
          }
        >
          TapeOutScan <ArrowTopRightIcon />
        </button>
        <div>
          <button
            className={`icon-button ${data.settings.pinned ? "teal" : ""}`}
            aria-label="Pin panel"
            aria-pressed={data.settings.pinned}
            onClick={() =>
              void command("update_settings", {
                settings: { ...data.settings, pinned: !data.settings.pinned },
              }).catch((e) => setError(String(e)))
            }
          >
            <PinLeftIcon />
          </button>
          <button
            className="icon-button"
            aria-label="Hide panel"
            onClick={() => void command("hide_panel")}
          >
            <Cross2Icon />
          </button>
          <button
            className="icon-button"
            aria-label="Quit TapeOut Live"
            onClick={() => void command("quit")}
          >
            <ExitIcon />
          </button>
        </div>
      </footer>
    </div>
  );
}
