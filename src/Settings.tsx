import { useState } from "react";
import { command, type Settings } from "./bridge";
export function SettingsForm({
  settings,
  onSaved,
}: {
  settings: Settings;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(settings),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [confirmClear, setConfirmClear] = useState(false);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm({ ...form, [key]: value });
  async function save() {
    setSaving(true);
    setError("");
    try {
      await command("update_settings", { settings: form });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="settings">
      <div className="section-title">
        <h2>Monitor settings</h2>
        <span className="tag">Local only</span>
      </div>
      <label>
        Wallet address
        <input
          value={form.wallet}
          spellCheck={false}
          placeholder="0x…"
          onChange={(e) => update("wallet", e.target.value)}
          autoComplete="off"
        />
      </label>
      <p className="helper">
        A public BSC address. No wallet connection or signing.
      </p>
      <label>
        Display name
        <input
          value={form.alias}
          maxLength={40}
          placeholder="My mining wallet"
          onChange={(e) => update("alias", e.target.value)}
        />
      </label>
      <label>
        Refresh interval
        <select
          value={form.interval}
          onChange={(e) => update("interval", Number(e.target.value))}
        >
          <option value={60}>Every 60 seconds</option>
          <option value={120}>Every 2 minutes</option>
          <option value={300}>Every 5 minutes</option>
        </select>
      </label>
      <label className="toggle">
        Power-drop notifications
        <input
          type="checkbox"
          checked={form.notifications}
          onChange={(e) => update("notifications", e.target.checked)}
        />
      </label>
      {form.notifications && (
        <label>
          Power drop threshold (%)
          <input
            type="number"
            min={1}
            max={100}
            value={form.powerDrop}
            onChange={(e) => update("powerDrop", Number(e.target.value))}
          />
        </label>
      )}
      <p className="helper">
        Confirmed by two fresh observations. Notifications cannot run while the
        app is quit.
      </p>
      <label className="toggle">
        Launch at login
        <input
          type="checkbox"
          checked={form.autostart}
          onChange={(e) => update("autostart", e.target.checked)}
        />
      </label>
      <label className="toggle">
        Keep panel open
        <input
          type="checkbox"
          checked={form.pinned}
          onChange={(e) => update("pinned", e.target.checked)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save settings"}
      </button>
      <div className="storage-actions">
        <button
          className="text-button"
          onClick={() => setConfirmClear(!confirmClear)}
        >
          Clear local history
        </button>
        {confirmClear && (
          <div className="notice">
            <p>
              Delete collected trends? Your address and current snapshots will
              remain.
            </p>
            <button
              onClick={() =>
                void command("clear_history")
                  .then(() => {
                    setConfirmClear(false);
                    onSaved();
                  })
                  .catch((e) => setError(String(e)))
              }
            >
              Confirm clear
            </button>
          </div>
        )}
      </div>
      <p className="helper">Data provider: TapeOutScan · TapeOut Live 0.1.0</p>
    </section>
  );
}
