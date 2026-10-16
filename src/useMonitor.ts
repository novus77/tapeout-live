import { useCallback, useEffect, useRef, useState } from "react";
import {
  command,
  defaults,
  onSnapshot,
  type Dashboard,
  type Settings,
} from "./bridge";
export const emptyDashboard: Dashboard = {
  settings: defaults,
  address: null,
  market: null,
  network: null,
  jobs: {},
};
export function useMonitor() {
  const [data, setData] = useState(emptyDashboard),
    [error, setError] = useState("");
  const revision = useRef(0);
  const expectedWallet = useRef<string | null>(null);
  const selection = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++revision.current;
    try {
      const next = await command<Dashboard>("get_dashboard");
      if (
        ticket === revision.current &&
        (expectedWallet.current === null ||
          next.settings.wallet === expectedWallet.current)
      ) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (ticket === revision.current) setError(String(e));
    }
  }, []);
  useEffect(() => {
    void load();
    let alive = true;
    let unlisten: (() => void) | undefined;
    void onSnapshot(() => void load()).then((fn) => {
      if (alive) unlisten = fn;
      else fn();
    });
    return () => {
      alive = false;
      revision.current++;
      unlisten?.();
    };
  }, [load]);
  const apply = useCallback(
    (settings: Settings) => {
      ++revision.current;
      setData((previous) => ({
        ...previous,
        settings,
        address:
          previous.settings.wallet === settings.wallet
            ? previous.address
            : null,
        jobs:
          previous.settings.wallet === settings.wallet
            ? previous.jobs
            : {
                ...previous.jobs,
                address: { busy: true, nextAt: 0, terminal: false },
              },
      }));
      void load();
    },
    [load],
  );
  const save = async (settings: Settings) => {
    const saved = await command<Settings>("update_settings", { settings });
    apply(saved);
    return saved;
  };
  const select = async (address: string) => {
    const ticket = ++selection.current;
    ++revision.current;
    expectedWallet.current = address;
    setData((previous) => ({
      ...previous,
      address: null,
      settings: {
        ...previous.settings,
        wallet: address,
        alias:
          previous.settings.accounts.find((a) => a.address === address)?.name ??
          "",
      },
      jobs: {
        ...previous.jobs,
        address: { busy: true, nextAt: 0, terminal: false },
      },
    }));
    try {
      const saved = await command<Settings>("select_account", { address });
      if (ticket === selection.current) {
        expectedWallet.current = null;
        apply(saved);
      }
    } catch (error) {
      if (ticket === selection.current) {
        expectedWallet.current = null;
        void load();
      }
      throw error;
    }
  };
  return { data, error, setError, load, save, select };
}
