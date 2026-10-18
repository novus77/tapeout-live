import { object, type Dashboard } from "./bridge";
import { Metric } from "./components";
import { translator } from "./i18n";
import { formatMetric } from "./metrics";
import { SnapshotTime, snapshotDetail } from "./SnapshotTime";
import { NetworkTrend } from "./NetworkTrend";

export function FabNetwork({ data }: { data: Dashboard }) {
  const { language, interval } = data.settings,
    t = translator(language),
    market = object(data.market?.data.market),
    network = data.network?.data ?? {};
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
          title={t("fabPrice")}
          value={market.token_price}
          unit="USDT"
          digits={4}
          detail={`${snapshotDetail(data.market, language, interval)} · ${t("referenceQuote")}`}
        />
        <Metric
          title={t("networkPower")}
          value={object(network.hashrate).total}
          unit="H"
          digits={0}
        />
      </div>
      <div className="network-meta">
        <span>
          {t("verified")} <b>{formatMetric(network.verified_weight, 0)}</b>
        </span>
        <span>
          {t("snapshotCount")} <b>{formatMetric(network.miner_count, 0)}</b>
        </span>
        <span>
          {t("emission")} <b>{formatMetric(market.daily_emission, 0)}</b> FAB
        </span>
      </div>
      <NetworkTrend data={data} />
    </section>
  );
}
