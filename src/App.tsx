import { useEffect } from "react";
import { CubeIcon, ReloadIcon } from "@radix-ui/react-icons";
import { command, native } from "./bridge";
import { translator, type Language } from "./i18n";
import { useMonitor } from "./useMonitor";
import {
  NetworkSection,
  WalletSection,
  CircuitSection,
  ActivitySection,
} from "./MonitorSections";
import { AccountManager } from "./AccountManager";
export default function App() {
  const { data, error, setError, save, select, selectProject, switching } =
      useMonitor(),
    t = translator(data.settings.language),
    busy = Object.values(data.jobs).some((j) => j.busy);
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
      if (e.key === "Escape") void command("hide_panel");
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
    try {
      await Promise.all(
        ["address", "market", "network"].map((resource) =>
          command("refresh_resource", { resource }),
        ),
      );
    } catch (e) {
      setError(String(e));
    }
  }
  async function language(value: Language) {
    try {
      await save({ ...data.settings, language: value });
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <div className="app-shell">
      <header className="header">
        <div className="brand">
          <span className="logo">
            <CubeIcon />
          </span>
          <h1>
            TapeOut <span>Live</span>
          </h1>
        </div>
        <div className="header-actions">
          <div className="language-switch" aria-label="Language">
            <button
              aria-pressed={data.settings.language === "zh"}
              disabled={switching}
              onClick={() => void language("zh")}
            >
              中文
            </button>
            <button
              aria-pressed={data.settings.language === "en"}
              disabled={switching}
              onClick={() => void language("en")}
            >
              EN
            </button>
          </div>
          <button
            className="icon-button"
            disabled={busy || switching}
            aria-label={t("refresh")}
            title={t("refresh")}
            onClick={() => void refresh()}
          >
            <ReloadIcon />
          </button>
        </div>
      </header>
      <div className="project-switch" role="group" aria-label={t("project")}>
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
        <span>{data.settings.project === "fab" ? "FabX" : "TapeOut"}</span>
      </div>
      <main>
        {!native && <div className="notice">{t("preview")}</div>}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <NetworkSection data={data} />
        <WalletSection
          data={data}
          select={select}
          onError={setError}
          disabled={switching}
        />
        {Object.entries(data.jobs)
          .filter(([, j]) => j.error)
          .map(([resource, job]) => (
            <div className="notice warning" role="status" key={resource}>
              <strong>
                {resource === "address" ? t("overview") : t("network")} ·{" "}
                {t("updateError")}
              </strong>
              <p>
                {job.terminal
                  ? t("compatibility")
                  : `${t("retry")} ${new Date(job.nextAt * 1000).toLocaleTimeString()}`}
              </p>
              <details>
                <summary>{t("errors")}</summary>
                <p>{job.error}</p>
              </details>
            </div>
          ))}
        <CircuitSection
          snapshot={data.address}
          language={data.settings.language}
        />
        <ActivitySection
          snapshot={data.address}
          language={data.settings.language}
        />
        <AccountManager
          key={`${data.settings.project}:${data.settings.wallet}`}
          settings={data.settings}
          save={save}
          disabled={switching}
        />
      </main>
    </div>
  );
}
