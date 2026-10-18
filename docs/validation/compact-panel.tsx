// Synthetic visual data; this entry point never loads the installed profile.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  defaults,
  settingsForProject,
  type Dashboard,
  type Settings,
} from "../../src/bridge";
import {
  CircuitSection,
  NetworkSection,
  WalletSection,
} from "../../src/MonitorSections";
import { SettingsPanel } from "../../src/SettingsPanel";
import { BrandMark, Icon } from "../../src/Icons";
import "../../src/styles.css";

const account = {
  name: "Studio",
  address: "0x0000000000000000000000000000000000000001",
};
function Preview() {
  const [settings, setSettings] = useState<Settings>({
    ...defaults,
    wallet: account.address,
    accounts: [account],
  });
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.material = "glass";
  }, [settings.theme]);
  const fab = settings.project === "fab";
  const observedAt = new Date().toISOString();
  const snapshot = (resource: string, data: Record<string, unknown>) => ({
    resource,
    fetchedAt: Date.now() / 1000,
    observedAt,
    stale: false,
    data,
  });
  const data: Dashboard = {
    settings,
    jobs: {},
    network: snapshot(fab ? "fab_network" : "network", {
      hashrate: {
        total: fab ? "303246624" : "1618278",
        snapshot: [{ miners: 20505 }],
      },
      verified_weight: "287370522",
      unverified_weight: "15876102",
      miner_count: "5365",
    }),
    market: snapshot(fab ? "fab_market" : "market", {
      market: {
        bem_usd: "35.53",
        token_price: "0.4902",
        verified_weight: "1577473",
        unverified_weight: "40759",
        daily_emission: "7200",
      },
    }),
    address: {
      ...snapshot(fab ? "fab_address" : "address", {
        summary: {
          total_hashrate: fab ? "19323990" : "36",
          total_estimated_daily_bem: "0.16",
          estimated_daily: "476.18563805",
          miner_count: fab ? "129" : "4",
          optimal: "1",
        },
        assets: {
          bem: "0",
          bnb: "0.0408",
          token: "0.12345678",
          observed_at: observedAt,
        },
        circuits: Array.from({ length: fab ? 5 : 4 }, (_, i) => ({
          processor: fab ? "FabX" : i === 2 ? "Behemoth" : "TapeOut",
          processor_address: `0x${String(i + 1).padStart(40, "0")}`,
          circuit_id: String(220 + i),
          circuit_ids: [String(220 + i)],
          task_id: 24 + i,
          task_name: [
            "4 位比较器",
            "8 位加法器（带 cin）",
            "二分频方波",
            "2 位多路选择器",
          ][i % 4],
          count: 1,
          status: i === 4 ? "inactive" : "active",
          pool: fab ? undefined : i === 2 ? "unverified" : "verified",
          current_hashrate: fab
            ? String(i === 4 ? 0 : 291690 - i * 50000)
            : [18, 10, 6, 2][i],
          estimated_daily_bem: [0.081, 0.045, 0.027, 0.009][i],
          estimated_daily: i === 4 ? "0" : "7.18788350",
          verified_weight: "291690",
          unverified_weight: "0",
          is_champion: i === 0 ? 1 : 0,
        })),
        circuitsComplete: !fab,
        circuitCount: fab ? 129 : 4,
      }),
      wallet: settings.wallet,
    },
  };
  const save = async (next: Settings) => {
    setSettings(settingsForProject(next));
    return next;
  };
  return (
    <>
      <div className="app-shell">
        <header className="header">
          <div className="brand">
            <span className="logo">
              <BrandMark />
            </span>
            <h1>
              TapeOut <span>Live</span>
            </h1>
          </div>
          <div className="header-actions">
            <div className="segmented" role="group" aria-label="Project">
              {(["bem", "fab"] as const).map((project) => (
                <button
                  key={project}
                  aria-pressed={settings.project === project}
                  onClick={() =>
                    setSettings(settingsForProject(settings, project))
                  }
                >
                  {project.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              className="icon-button"
              aria-label="Settings"
              aria-pressed={editing}
              onClick={() => setEditing(!editing)}
            >
              <Icon name="gear" />
            </button>
            <button className="icon-button" aria-label="Refresh">
              <Icon name="refresh" />
            </button>
          </div>
        </header>
        <main className={editing ? "settings-main" : "dashboard-main"}>
          {editing ? (
            <SettingsPanel
              settings={settings}
              save={save}
              select={async () => {}}
              disabled={false}
              effectiveTheme="light"
            />
          ) : (
            <div className="monitor-dashboard">
              <NetworkSection data={data} />
              <WalletSection
                data={data}
                select={async () => {}}
                onError={() => {}}
              />
              <CircuitSection
                key={`${settings.project}:${settings.wallet}`}
                snapshot={data.address}
                language={settings.language}
              />
            </div>
          )}
        </main>
      </div>
      <p
        style={{
          position: "fixed",
          bottom: 8,
          left: 12,
          fontSize: 10,
          color: "#6b6a66",
        }}
      >
        组件验证 · 示例数据 · 不读取正式应用账户
      </p>
    </>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
