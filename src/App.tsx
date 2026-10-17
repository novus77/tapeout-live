import { useEffect, useRef, useState } from "react";
import { command, native } from "./bridge";
import { locale, translator } from "./i18n";
import { useMonitor } from "./useMonitor";
import { NetworkSection, WalletSection } from "./MonitorSections";
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
      <main>
        {!native && <div className="notice preview">{t("preview")}</div>}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {data.refreshBatch &&
          data.refreshBatch.entries.some((entry) =>
            ["failed", "deferred", "cancelled"].includes(entry.status),
          ) && (
            <div className="batch-outcomes" role="status">
              {data.refreshBatch.entries
                .filter((entry) =>
                  ["failed", "deferred", "cancelled"].includes(entry.status),
                )
                .map((entry) => (
                  <p key={entry.resource}>
                    {entry.resource.startsWith("fab_") ? "FAB" : "BEM"} ·{" "}
                    {t(
                      entry.resource.endsWith("address")
                        ? "overview"
                        : entry.resource.endsWith("market")
                          ? entry.resource.startsWith("fab_")
                            ? "fabPrice"
                            : "bemPrice"
                          : "network",
                    )}{" "}
                    · {t(entry.status)}
                    {entry.error ? ` · ${entry.error}` : ""}
                  </p>
                ))}
            </div>
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
          <>
            <NetworkSection data={data} />
            <WalletSection
              data={data}
              select={select}
              onError={setError}
              disabled={switching}
              openSettings={() => setSettingsOpen(true)}
            />
            {Object.entries(data.jobs)
              .filter(([, j]) => j.error)
              .map(([resource, job]) => (
                <details className="notice warning" key={resource}>
                  <summary>
                    {resource === "address" ? t("overview") : t("network")} ·{" "}
                    {t("updateError")}
                  </summary>
                  <p>
                    {job.terminal
                      ? t("compatibility")
                      : `${t("retry")} ${new Date(job.nextAt * 1000).toLocaleTimeString(locale(data.settings.language))}`}
                  </p>
                  <p>{job.error}</p>
                </details>
              ))}
          </>
        )}
      </main>
    </div>
  );
}
