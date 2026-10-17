import { useState } from "react";
import {
  accountProjects,
  settingsForProject,
  type Project,
  type Settings,
} from "./bridge";
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
    [removing, setRemoving] = useState(""),
    [editing, setEditing] = useState(""),
    [editName, setEditName] = useState("");
  const [projects, setProjects] = useState<Project[]>([settings.project]);
  const [editProjects, setEditProjects] = useState<Project[]>([]);
  const projectControl = (
    value: Project[],
    change: (projects: Project[]) => void,
  ) => (
    <fieldset className="account-projects" disabled={disabled}>
      <legend>{t("miningProjects")}</legend>
      {(["bem", "fab"] as const).map((project) => (
        <label key={project}>
          <input
            type="checkbox"
            checked={value.includes(project)}
            onChange={(event) =>
              change(
                event.target.checked
                  ? [...value, project]
                  : value.filter((item) => item !== project),
              )
            }
          />
          {project.toUpperCase()}
        </label>
      ))}
    </fieldset>
  );
  async function persist(next: Settings) {
    setError("");
    try {
      await save(settingsForProject(next));
      return true;
    } catch (e) {
      setError(String(e).replace(/^Error: /, ""));
      return false;
    }
  }
  async function add() {
    if (!projects.length) {
      setError(t("chooseMiningProject"));
      return;
    }
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
        accounts: [
          ...settings.accounts,
          { address: value, name: alias, projects },
        ],
        project: projects.includes(settings.project)
          ? settings.project
          : projects[0],
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
    ) {
      setRemoving("");
      setEditing("");
    }
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
            setProjects([settings.project]);
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
            <div className="account-row">
              <button
                className="saved-account"
                aria-pressed={settings.wallet === account.address}
                disabled={
                  disabled ||
                  !accountProjects(account).includes(settings.project)
                }
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
                  <span className="account-project-tags">
                    {accountProjects(account)
                      .map((project) => project.toUpperCase())
                      .join(" / ")}
                  </span>
                </span>
                {settings.wallet === account.address && (
                  <span className="selected-label">{t("selected")}</span>
                )}
              </button>
              <button
                className="account-edit-button"
                disabled={disabled}
                aria-label={`${t("editAccount")} ${account.name || `${t("account")} ${i + 1}`}`}
                onClick={() => {
                  setEditing(account.address);
                  setEditName(account.name);
                  setEditProjects(accountProjects(account));
                  setError("");
                }}
              >
                {t("edit")}
              </button>
              <button
                type="button"
                className="icon-button account-remove-button"
                disabled={disabled}
                aria-label={`${t("remove")} ${account.name || `${t("account")} ${i + 1}`}`}
                title={`${t("remove")} ${account.name || `${t("account")} ${i + 1}`}`}
                onClick={() => {
                  setRemoving(account.address);
                  setError("");
                }}
              >
                <Icon name="trash" />
              </button>
            </div>
            {editing === account.address && (
              <div className="account-edit">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const alias = editName.trim();
                    if (!editProjects.length) {
                      setError(t("chooseMiningProject"));
                      return;
                    }
                    if ([...alias].length > 40) {
                      setError(t("nameLimit"));
                      return;
                    }
                    void persist({
                      ...settings,
                      accounts: settings.accounts.map((a) =>
                        a.address === account.address
                          ? { ...a, name: alias, projects: editProjects }
                          : a,
                      ),
                      alias:
                        settings.wallet === account.address
                          ? alias
                          : settings.alias,
                    }).then((saved) => {
                      if (saved) setEditing("");
                    });
                  }}
                >
                  <label>
                    {t("name")}
                    <input
                      name="name"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      disabled={disabled}
                    />
                  </label>
                  <label>
                    {t("address")}
                    <input readOnly value={account.address} />
                  </label>
                  {projectControl(editProjects, setEditProjects)}
                  <div className="form-actions">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setEditing("");
                        setError("");
                      }}
                    >
                      {t("cancel")}
                    </button>
                    <button disabled={disabled}>{t("saveAccount")}</button>
                  </div>
                </form>
              </div>
            )}
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
          {projectControl(projects, setProjects)}
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
