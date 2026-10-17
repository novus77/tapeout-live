// Synthetic visual data; this entry point never loads the installed profile.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { defaults, type Dashboard, type Settings } from "../../src/bridge";
import { NetworkSection, WalletSection } from "../../src/MonitorSections";
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
          total_hashrate: "36",
          total_estimated_daily_bem: "0.16",
          estimated_daily: "0.00000081",
          miner_count: "2",
          optimal: "0",
        },
        assets: {
          bem: "0",
          bnb: "0.0408",
          token: "0.12345678",
          observed_at: observedAt,
        },
        circuits: [],
      }),
      wallet: settings.wallet,
    },
  };
  const save = async (next: Settings) => {
    setSettings(next);
    return next;
  };
  return (
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
                onClick={() => setSettings({ ...settings, project })}
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
      <main>
        {editing ? (
          <SettingsPanel
            settings={settings}
            save={save}
            select={async () => {}}
            disabled={false}
            effectiveTheme="light"
          />
        ) : (
          <>
            <NetworkSection data={data} />
            <WalletSection
              data={data}
              select={async () => {}}
              onError={() => {}}
            />
          </>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
