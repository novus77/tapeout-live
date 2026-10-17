import { useState } from "react";
import { PlusIcon, TrashIcon, GearIcon } from "@radix-ui/react-icons";
import { command, type Settings } from "./bridge";
import { translator } from "./i18n";
export function AccountManager({
  settings,
  save,
  disabled = false,
}: {
  settings: Settings;
  save: (settings: Settings) => Promise<Settings>;
  disabled?: boolean;
}) {
  const [form, setForm] = useState(settings),
    [address, setAddress] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const t = translator(settings.language);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      let next = {
        ...form,
        language: settings.language,
        project: settings.project,
      };
      if (address.trim()) {
        const value = address.trim().toLowerCase();
        if (!/^0x[0-9a-f]{40}$/.test(value))
          throw new Error(t("invalidAddress"));
        if (next.accounts.some((a) => a.address === value))
          throw new Error(t("duplicate"));
        if (next.accounts.length >= 20) throw new Error(t("limit"));
        next = {
          ...next,
          accounts: [...next.accounts, { address: value, name: name.trim() }],
          wallet: next.wallet || value,
        };
      }
      if (!next.accounts.some((a) => a.address === next.wallet))
        next.wallet = next.accounts[0]?.address ?? "";
      const saved = await save(next);
      setForm(saved);
      setAddress("");
      setName("");
    } catch (e) {
      setError(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(false);
    }
  }
  function remove(value: string) {
    const accounts = form.accounts.filter((a) => a.address !== value);
    setForm({
      ...form,
      accounts,
      wallet:
        form.wallet === value ? (accounts[0]?.address ?? "") : form.wallet,
    });
  }
  return (
    <details
      className="account-manager"
      open={settings.accounts.length === 0 ? true : undefined}
    >
      <summary>
        <GearIcon />
        {t("accounts")}
        <span>{settings.accounts.length}</span>
      </summary>
      <fieldset className="manager-content" disabled={disabled || busy}>
        <p className="helper">
          {t("accountHelp")} {t("addHelp")}
        </p>
        {form.accounts.map((a, i) => (
          <div className="saved-account" key={a.address}>
            <div>
              <label>
                {t("name")}
                <input
                  maxLength={40}
                  value={a.name}
                  placeholder={`${t("account")} ${i + 1}`}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      accounts: form.accounts.map((row) =>
                        row.address === a.address
                          ? { ...row, name: e.target.value }
                          : row,
                      ),
                    })
                  }
                />
              </label>
              <code title={a.address}>
                {a.address.slice(0, 10)}…{a.address.slice(-8)}
              </code>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label={`${t("remove")} ${a.name || a.address}`}
              onClick={() => remove(a.address)}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
        <div className="add-account">
          <h3>
            <PlusIcon />
            {t("add")}
          </h3>
          <label>
            {t("address")}
            <input
              spellCheck={false}
              autoComplete="off"
              placeholder="0x…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <label>
            {t("name")}
            <input
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>
        <label>
          {t("interval")}
          <select
            value={form.interval}
            onChange={(e) =>
              setForm({ ...form, interval: Number(e.target.value) })
            }
          >
            {[60, 120, 300].map((value) => (
              <option key={value} value={value}>
                {value} {t("seconds")}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          {t("notifications")}
          <input
            type="checkbox"
            checked={form.notifications}
            onChange={(e) =>
              setForm({ ...form, notifications: e.target.checked })
            }
          />
        </label>
        {form.notifications && (
          <label>
            {t("threshold")}
            <input
              type="number"
              min={1}
              max={100}
              value={form.powerDrop}
              onChange={(e) =>
                setForm({ ...form, powerDrop: Number(e.target.value) })
              }
            />
          </label>
        )}
        <p className="helper">{t("notificationHint")}</p>
        <label className="toggle">
          {t("autostart")}
          <input
            type="checkbox"
            checked={form.autostart}
            onChange={(e) => setForm({ ...form, autostart: e.target.checked })}
          />
        </label>
        <label className="toggle">
          {t("pinned")}
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? t("saving") : t("save")}
        </button>
        <div className="storage-actions">
          <button className="text-button" onClick={() => setConfirm(!confirm)}>
            {t("clearHistory")}
          </button>
          {confirm && (
            <div className="notice">
              <p>{t("clearConfirm")}</p>
              <button
                onClick={() =>
                  void command("clear_history")
                    .then(() => setConfirm(false))
                    .catch((e) => setError(String(e)))
                }
              >
                {t("confirm")}
              </button>
            </div>
          )}
        </div>
        <p className="helper">{t("localOnly")} · v0.3.0</p>
      </fieldset>
    </details>
  );
}
