import type { Dashboard } from "./bridge";
import { translator } from "./i18n";
import { TrendChart } from "./TrendChart";
export function NetworkTrend({ data }: { data: Dashboard }) {
  const expected = data.settings.project === "fab" ? "fab_network" : "network";
  return (
    <TrendChart
      key={expected}
      input={
        data.network?.resource === expected
          ? data.network.data.networkHistory
          : undefined
      }
      title={translator(data.settings.language)("networkTrend")}
      unit="H"
      language={data.settings.language}
      collapsible
    />
  );
}
