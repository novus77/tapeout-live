import { useEffect, useRef, useState } from "react";
import { accountProjects, command, native } from "./bridge";
import { translator } from "./i18n";
import { useMonitor } from "./useMonitor";
import {
  CircuitSection,
  NetworkSection,
  WalletSection,
} from "./MonitorSections";
import { visibleMinerSnapshot } from "./minerData";
import { SettingsPanel } from "./SettingsPanel";
import { useAppearance } from "./appearance";
import { BrandMark, Icon } from "./Icons";
export default function App() {
  const {
      data,
      error,
      setError,
      save,
      select,
      selectProject,
      switching,
      ready,
      refreshAll,
    } = useMonitor(),
    t = translator(data.settings.language);
  const admission = useRef(false);
  const [admitting, setAdmitting] = useState(false);
  const busy = admitting || data.refreshBatch?.busy;
  const [settingsOpen, setSettingsOpen] = useState(false),
    theme = useAppearance(data.settings, ready);
  const walletSnapshot = visibleMinerSnapshot(data);
  const hasAccount = data.settings.accounts.some(
    (account) =>
      account.address === data.settings.wallet &&
      accountProjects(account).includes(data.settings.project),
  );
  useEffect(() => {
    document.documentElement.lang =
      data.settings.language === "zh" ? "zh-CN" : "en";
  }, [data.settings.language]);
  useEffect(() => {
    const update = () =>
      void command("set_network_visible", {
        visible:
          document.visibilityState === "visible" &&
          (document.hasFocus() || data.settings.pinned),
      });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) void command("hide_panel");
    };
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", update);
    };
  }, [data.settings.pinned]);
  async function refresh() {
    if (admission.current || data.refreshBatch?.busy || switching) return;
    admission.current = true;
    setAdmitting(true);
    try {
      await refreshAll();
    } catch (e) {
      setError(String(e));
    } finally {
      admission.current = false;
      setAdmitting(false);
    }
  }
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
          <div
            className="segmented project-switch"
            role="group"
            aria-label={t("project")}
          >
            {(["bem", "fab"] as const).map((project) => (
              <button
                key={project}
                aria-pressed={data.settings.project === project}
                disabled={switching}
                onClick={() =>
                  void selectProject(project).catch((e) => setError(String(e)))
                }
              >
                {project.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            disabled={switching}
            aria-label={t("settings")}
            aria-pressed={settingsOpen}
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Icon name="gear" />
          </button>
          <button
            className="icon-button"
            disabled={busy || switching}
            aria-busy={!!busy}
            title={busy ? t("syncing") : t("refresh")}
            aria-label={t("refresh")}
            onClick={() => void refresh()}
          >
            <Icon name="refresh" />
          </button>
        </div>
      </header>
      <main className={settingsOpen ? "settings-main" : "dashboard-main"}>
        {!native && <div className="notice preview">{t("preview")}</div>}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {settingsOpen ? (
          <SettingsPanel
            settings={data.settings}
            save={save}
            select={select}
            disabled={switching}
            effectiveTheme={theme}
          />
        ) : (
          <div className="monitor-dashboard">
            <NetworkSection data={data} />
            <WalletSection
              data={{ ...data, address: walletSnapshot }}
              select={select}
              onError={setError}
              disabled={switching}
              openSettings={() => setSettingsOpen(true)}
            />
            {hasAccount && (
              <CircuitSection
                key={`${data.settings.project}:${data.settings.wallet}`}
                snapshot={walletSnapshot}
                language={data.settings.language}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
