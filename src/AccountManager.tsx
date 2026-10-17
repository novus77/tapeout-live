import { useState } from "react";
import { type Settings } from "./bridge";
import { translator } from "./i18n";
import { Icon } from "./Icons";
export function AccountManager({
  settings,
  save,
  select,
  disabled,
}: {
  settings: Settings;
  save: (settings: Settings) => Promise<Settings>;
  select: (address: string) => Promise<void>;
  disabled: boolean;
}) {
  const t = translator(settings.language);
  const [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [address, setAddress] = useState(""),
    [error, setError] = useState(""),
    [removing, setRemoving] = useState("");
  async function persist(next: Settings) {
    setError("");
    try {
      await save(next);
      return true;
    } catch (e) {
      setError(String(e).replace(/^Error: /, ""));
      return false;
    }
  }
  async function add() {
    const value = address.trim().toLowerCase(),
      alias = name.trim();
    const invalid = !/^0x[0-9a-f]{40}$/.test(value)
      ? "invalidAddress"
      : settings.accounts.some((a) => a.address.toLowerCase() === value)
        ? "duplicate"
        : settings.accounts.length >= 20
          ? "limit"
          : [...alias].length > 40
            ? "nameLimit"
            : null;
    if (invalid) {
      setError(t(invalid));
      return;
    }
    if (
      await persist({
        ...settings,
        accounts: [...settings.accounts, { address: value, name: alias }],
        wallet: value,
        alias,
      })
    ) {
      setAdding(false);
      setName("");
      setAddress("");
    }
  }
  async function remove() {
    const accounts = settings.accounts.filter((a) => a.address !== removing),
      wallet =
        settings.wallet === removing
          ? (accounts[0]?.address ?? "")
          : settings.wallet;
    if (
      await persist({
        ...settings,
        accounts,
        wallet,
        alias: accounts.find((a) => a.address === wallet)?.name ?? "",
      })
    )
      setRemoving("");
  }
  return (
    <section className="account-manager">
      <div className="settings-group-title">
        <h3>{t("savedAccounts")}</h3>
        <button
          className="add-button"
          disabled={disabled || adding || settings.accounts.length >= 20}
          onClick={() => {
            setAdding(true);
            setError("");
          }}
        >
          <Icon name="plus" />
          {t("add")}
        </button>
      </div>
      <div className="saved-accounts">
        {settings.accounts.map((account, i) => (
          <div className="account-item" key={account.address}>
            <button
              className="saved-account"
              aria-pressed={settings.wallet === account.address}
              disabled={disabled}
              onClick={() =>
                void select(account.address).catch((e) => setError(String(e)))
              }
            >
              <span className="account-avatar">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="account-info">
                <strong>{account.name || `${t("account")} ${i + 1}`}</strong>
                <code>
                  {account.address.slice(0, 8)}…{account.address.slice(-6)}
                </code>
              </span>
              {settings.wallet === account.address && (
                <span className="selected-label">{t("selected")}</span>
              )}
            </button>
            <details className="account-edit">
              <summary>
                {t("editAccount")} {account.name || `${t("account")} ${i + 1}`}
              </summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const alias = String(
                    new FormData(event.currentTarget).get("name") ?? "",
                  ).trim();
                  if ([...alias].length > 40) {
                    setError(t("nameLimit"));
                    return;
                  }
                  void persist({
                    ...settings,
                    accounts: settings.accounts.map((a) =>
                      a.address === account.address ? { ...a, name: alias } : a,
                    ),
                    alias:
                      settings.wallet === account.address
                        ? alias
                        : settings.alias,
                  });
                }}
              >
                <label>
                  {t("name")}
                  <input
                    name="name"
                    defaultValue={account.name}
                    disabled={disabled}
                  />
                </label>
                <div className="form-actions">
                  <button disabled={disabled}>{t("saveAccount")}</button>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`${t("remove")} ${account.name || account.address}`}
                    onClick={() => setRemoving(account.address)}
                  >
                    {t("remove")}
                  </button>
                </div>
              </form>
            </details>
          </div>
        ))}
      </div>
      <p className="settings-note">{t("accountHelp")}</p>
      {adding && (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <h3>{t("add")}</h3>
          <label>
            {t("name")}
            <input
              value={name}
              disabled={disabled}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {t("address")}
            <input
              value={address}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setAdding(false);
                setName("");
                setAddress("");
                setError("");
              }}
            >
              {t("cancel")}
            </button>
            <button className="primary" disabled={disabled}>
              {t("saveAccount")}
            </button>
          </div>
        </form>
      )}
      {removing && (
        <div className="notice" role="alertdialog" aria-label={t("remove")}>
          <p>{t("removeConfirm")}</p>
          <div className="form-actions">
            <button disabled={disabled} onClick={() => setRemoving("")}>
              {t("cancel")}
            </button>
            <button disabled={disabled} onClick={() => void remove()}>
              {t("confirmRemove")}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
