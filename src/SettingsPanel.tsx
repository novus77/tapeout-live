import type { ReactNode } from "react";
import type { Settings } from "./bridge";
import { translator, type Message } from "./i18n";
import { AccountManager } from "./AccountManager";
export function SettingsPanel({
  settings,
  save,
  select,
  disabled,
  effectiveTheme,
}: {
  settings: Settings;
  save: (settings: Settings) => Promise<Settings>;
  select: (address: string) => Promise<void>;
  disabled: boolean;
  effectiveTheme: "light" | "dark";
}) {
  const t = translator(settings.language);
  const change = (patch: Partial<Settings>) => {
    void save({ ...settings, ...patch }).catch(() => {});
  };
  const row = (label: Message, control: ReactNode, hint?: Message) => (
    <div className="preference-row">
      <div>
        <strong>{t(label)}</strong>
        {hint && <p>{t(hint)}</p>}
      </div>
      {control}
    </div>
  );
  const toggle = (
    key: "autostart" | "followSystemTheme" | "pinned",
    hint: Message,
  ) =>
    row(
      key,
      <button
        className="switch"
        role="switch"
        aria-label={t(key)}
        aria-checked={settings[key]}
        disabled={disabled}
        onClick={() => change({ [key]: !settings[key] })}
      />,
      hint,
    );
  return (
    <>
      <h2 className="settings-title">{t("settings")}</h2>
      <p className="subtitle">{t("preferences")}</p>
      <AccountManager
        settings={settings}
        save={save}
        select={select}
        disabled={disabled}
      />
      {row(
        "theme",
        <div
          className="segmented theme-choice"
          role="group"
          aria-label={t("theme")}
        >
          {(["light", "dark"] as const).map((theme) => (
            <button
              key={theme}
              disabled={disabled || settings.followSystemTheme}
              aria-pressed={effectiveTheme === theme}
              onClick={() => change({ theme })}
            >
              {t(theme === "light" ? "warm" : "smoke")}
            </button>
          ))}
        </div>,
      )}
      {row(
        "language",
        <div className="segmented" role="group" aria-label={t("language")}>
          <button
            disabled={disabled}
            aria-pressed={settings.language === "zh"}
            onClick={() => change({ language: "zh" })}
          >
            中文
          </button>
          <span className="language-divider" aria-hidden="true">
            |
          </span>
          <button
            disabled={disabled}
            aria-pressed={settings.language === "en"}
            onClick={() => change({ language: "en" })}
          >
            EN
          </button>
        </div>,
      )}
      {toggle("autostart", "startupHint")}
      {toggle("followSystemTheme", "followHint")}
      {row(
        "interval",
        <select
          aria-label={t("interval")}
          disabled={disabled}
          value={settings.interval}
          onChange={(e) => change({ interval: Number(e.target.value) })}
        >
          {[60, 120, 300].map((value) => (
            <option key={value} value={value}>
              {value} {t("seconds")}
            </option>
          ))}
        </select>,
        "intervalHint",
      )}
      {toggle("pinned", "pinnedHint")}
      <p className="settings-footnote" role="status">
        {disabled ? t("saving") : t("autoSave")}
        <br />
        {t("localOnly")}
      </p>
    </>
  );
}
