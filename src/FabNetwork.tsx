import { object, type Dashboard } from "./bridge";
import { Metric } from "./components";
import { translator } from "./i18n";
import { formatMetric } from "./metrics";
import { SnapshotTime } from "./SnapshotTime";

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
          language={language}
          interval={900}
        />
      </div>
      <div className="metric-grid compact">
        <Metric
          title={t("fabPrice")}
          value={market.token_price}
          unit="USDT"
          digits={4}
        />
        <Metric
          title={t("networkPower")}
          value={object(network.hashrate).total}
          unit="H"
          digits={0}
        />
        <Metric
          title={t("verifiedWeight")}
          value={network.verified_weight}
          digits={0}
        />
        <Metric
          title={t("emission")}
          value={market.daily_emission}
          unit="FAB"
        />
      </div>
      <div className="network-meta">
        <span>
          {t("unverified")} {t("weight")}{" "}
          <b>{formatMetric(network.unverified_weight, 0)}</b>
        </span>
        <span>
          {t("snapshotCount")} <b>{formatMetric(network.miner_count, 0)}</b>
        </span>
      </div>
      <div className="source-note">
        {t("fabPrice")} ·{" "}
        <SnapshotTime
          snapshot={data.market}
          language={language}
          interval={interval}
        />
      </div>
      <p className="helper">{t("referenceQuote")}</p>
    </section>
  );
}
