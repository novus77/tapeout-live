// Isolated visual fixture, never imported by the production entry point.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { defaults, type Dashboard, type Settings } from "../../../src/bridge";
import { NetworkSection, WalletSection } from "../../../src/MonitorSections";
import { PowerHistory } from "../../../src/PowerHistory";
import { SettingsPanel } from "../../../src/SettingsPanel";
import { BrandMark, Icon } from "../../../src/Icons";
import "../../../src/styles.css";

const accounts = [
  { name: "工作室", address: "0x0000000000000000000000000000000000000001" },
  { name: "备用账户", address: "0x0000000000000000000000000000000000000002" },
];
const observedAt = new Date().toISOString();
const sampleEnd = Math.floor(Date.now() / 1000);
function dashboard(settings: Settings, flat: boolean): Dashboard {
  const fab = settings.project === "fab";
  const snapshot = (resource: string, data: Record<string, unknown>) => ({
    resource,
    fetchedAt: sampleEnd,
    observedAt,
    stale: false,
    data,
  });
  return {
    settings,
    jobs: {},
    network: snapshot(fab ? "fab_network" : "network", {
      hashrate: {
        total: fab ? "302420040" : "1617521",
        snapshot: [{ miners: 20449 }],
      },
      verified_weight: "286545738",
      unverified_weight: "15874302",
      miner_count: "5339",
    }),
    market: snapshot(fab ? "fab_market" : "market", {
      market: {
        bem_usd: "37.18",
        token_price: "0.5751",
        verified_weight: "1576738",
        unverified_weight: "40755",
        daily_emission: "7200",
      },
    }),
    address: {
      ...snapshot(fab ? "fab_address" : "address", {
        summary: {
          total_hashrate: fab ? "842" : "42",
          total_estimated_daily_bem: "0.23",
          estimated_daily: "0.00000081",
          miner_count: "2",
          optimal: "0",
        },
        assets: {
          bem: "1.2847",
          bnb: "0.0374",
          token: "0.12345678",
          observed_at: observedAt,
        },
        circuits: [],
        hashrateHistory: {
          points: [76, 76, 75, 75, 42, 42].map((power, index) => ({
            time: sampleEnd - (5 - index) * 3600,
            weight: String(flat ? 42 : fab ? power * 13 : power),
          })),
        },
      }),
      wallet: settings.wallet,
    },
  };
}

function Fixture() {
  const [settings, setSettings] = useState<Settings>({
    ...defaults,
    accounts,
    wallet: accounts[0].address,
    alias: accounts[0].name,
  });
  const [editing, setEditing] = useState(false);
  const [flat, setFlat] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.language === "zh" ? "zh-CN" : "en";
  }, [settings.theme, settings.language]);
  async function select(address: string) {
    setSettings((previous) => ({
      ...previous,
      wallet: address,
      alias: previous.accounts.find((a) => a.address === address)?.name ?? "",
    }));
  }
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
                  aria-pressed={project === settings.project}
                  onClick={() => setSettings({ ...settings, project })}
                >
                  {project.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              className="icon-button"
              aria-label="Settings"
              onClick={() => setEditing(!editing)}
            >
              <Icon name="gear" />
            </button>
          </div>
        </header>
        <main>
          {editing ? (
            <SettingsPanel
              settings={settings}
              save={async (value) => {
                setSettings(value);
                return value;
              }}
              select={select}
              disabled={false}
              effectiveTheme={settings.theme}
            />
          ) : (
            <>
              <NetworkSection data={dashboard(settings, flat)} />
              <WalletSection
                data={dashboard(settings, flat)}
                select={select}
                onError={console.error}
              />
              <PowerHistory data={dashboard(settings, flat)} />
            </>
          )}
        </main>
      </div>
      <aside
        style={{
          position: "fixed",
          left: 444,
          top: 24,
          width: 260,
          color: "#555",
          background: "#f6f5f1",
          padding: 16,
          borderRadius: 10,
        }}
      >
        <h2>Synthetic visual fixture</h2>
        <p>No live data. No desktop preferences or wallet changes.</p>
        <button onClick={() => setFlat(!flat)}>Toggle flat history</button>
        <button
          onClick={() => {
            const many = Array.from({ length: 20 }, (_, index) => ({
              address: `0x${String(index + 1).padStart(40, "0")}`,
              name:
                index === 0
                  ? "Long account name ".repeat(3).slice(0, 40)
                  : index === 1
                    ? ""
                    : `Account ${index + 1}`,
            }));
            setSettings({
              ...settings,
              accounts: many,
              wallet: many[0].address,
              alias: many[0].name,
            });
          }}
        >
          Load 20 long accounts
        </button>
        <button
          onClick={() =>
            setSettings({
              ...settings,
              accounts,
              wallet: accounts[0].address,
              alias: accounts[0].name,
            })
          }
        >
          Restore two accounts
        </button>
      </aside>
    </>
  );
}
const fixtureRoot = createRoot(document.getElementById("root")!);
fixtureRoot.render(<Fixture />);
// Unlike the app entry, this standalone fixture can be re-evaluated by Vite.
if (import.meta.hot) import.meta.hot.dispose(() => fixtureRoot.unmount());
