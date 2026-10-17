import { useEffect, useId, useRef, useState } from "react";
import type { Account } from "./bridge";
import { translator, type Language } from "./i18n";
import { Icon } from "./Icons";

export function AccountSelector({
  accounts,
  wallet,
  language,
  disabled,
  select,
  onError,
}: {
  accounts: Account[];
  wallet: string;
  language: Language;
  disabled: boolean;
  select: (address: string) => Promise<void>;
  onError: (error: string) => void;
}) {
  const t = translator(language),
    id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const restoreFocus = useRef(false);
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false);
  const selected = Math.max(
    0,
    accounts.findIndex((a) => a.address === wallet),
  );
  const name = (i: number) => accounts[i]?.name || `${t("account")} ${i + 1}`;
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (restoreFocus.current && !pending && !disabled) {
      restoreFocus.current = false;
      trigger.current?.focus();
    }
  }, [pending, disabled]);
  useEffect(() => {
    if (!open) return;
    options.current[selected]?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, selected]);
  if (!accounts.length) return null;
  const blocked = disabled || pending;
  async function choose(address: string) {
    if (blocked) return;
    restoreFocus.current = true;
    setPending(true);
    close();
    try {
      await select(address);
    } catch (error) {
      onError(String(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div
      className="account-selector"
      ref={root}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="account-trigger"
        title={name(selected)}
        aria-label={`${t("choose")}: ${name(selected)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={blocked}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{name(selected)}</span>
        <Icon name="caret" />
      </button>
      {open && (
        <div
          id={id}
          className="account-options"
          role="listbox"
          aria-label={t("choose")}
        >
          {accounts.map((account, i) => (
            <button
              type="button"
              key={account.address}
              ref={(node) => {
                options.current[i] = node;
              }}
              role="option"
              aria-selected={wallet === account.address}
              aria-label={`${name(i)} ${account.address}`}
              disabled={blocked}
              tabIndex={-1}
              title={account.address}
              onClick={() => void choose(account.address)}
              onKeyDown={(event) => {
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? accounts.length - 1
                      : event.key === "ArrowDown"
                        ? (i + 1) % accounts.length
                        : event.key === "ArrowUp"
                          ? (i + accounts.length - 1) % accounts.length
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  options.current[next]?.focus();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void choose(account.address);
                }
              }}
            >
              <span>
                <strong>{name(i)}</strong>
                <code>
                  {account.address.slice(0, 8)}…{account.address.slice(-6)}
                </code>
              </span>
              {wallet === account.address && <Icon name="check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
