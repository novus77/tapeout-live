import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reloadQueue } from "./reloadQueue";
import {
  command,
  defaults,
  onSnapshot,
  settingsForProject,
  type Dashboard,
  type Settings,
  type Project,
  type RefreshBatch,
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
  const expectedProject = useRef<Project | null>(null);
  const [switching, setSwitching] = useState(false);
  const [ready, setReady] = useState(false);
  const selection = useRef(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  const readDashboard = useCallback(async () => {
    if (!mounted.current) return;
    const ticket = ++revision.current;
    try {
      const next = await command<Dashboard>("get_dashboard");
      if (
        ticket === revision.current &&
        (expectedWallet.current === null ||
          next.settings.wallet === expectedWallet.current) &&
        (expectedProject.current === null ||
          next.settings.project === expectedProject.current)
      ) {
        setData({ ...next, settings: { ...defaults, ...next.settings } });
        setReady(true);
        setError("");
      }
    } catch (e) {
      if (ticket === revision.current) setError(String(e));
      if (ticket === revision.current) setReady(true);
    }
  }, []);
  const load = useMemo(() => reloadQueue(readDashboard), [readDashboard]);
  useEffect(() => {
    mounted.current = true;
    void load();
    let alive = true;
    let unlisten: (() => void) | undefined;
    void onSnapshot(() => void load()).then((fn) => {
      if (alive) unlisten = fn;
      else fn();
    });
    return () => {
      mounted.current = false;
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
          previous.settings.wallet === settings.wallet &&
          previous.settings.project === settings.project
            ? previous.address
            : null,
        jobs:
          previous.settings.wallet === settings.wallet &&
          previous.settings.project === settings.project
            ? previous.jobs
            : {
                ...previous.jobs,
                address: { busy: true, nextAt: 0, terminal: false },
              },
        market:
          previous.settings.project === settings.project
            ? previous.market
            : null,
        network:
          previous.settings.project === settings.project
            ? previous.network
            : null,
      }));
      void load();
    },
    [load],
  );
  const save = async (settings: Settings) => {
    if (pending.current)
      throw new Error("A settings change is already pending.");
    pending.current = true;
    setSwitching(true);
    try {
      const saved = await command<Settings>("update_settings", { settings });
      apply(saved);
      return saved;
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      pending.current = false;
      setSwitching(false);
    }
  };
  const select = async (address: string) => {
    if (pending.current) return;
    pending.current = true;
    setSwitching(true);
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
    } finally {
      if (ticket === selection.current) {
        pending.current = false;
        setSwitching(false);
      }
    }
  };
  const selectProject = async (project: Project) => {
    if (pending.current) return;
    pending.current = true;
    const ticket = ++selection.current;
    ++revision.current;
    setSwitching(true);
    expectedProject.current = project;
    setData((previous) => ({
      ...previous,
      settings: settingsForProject(previous.settings, project),
      address: null,
      market: null,
      network: null,
      jobs: {},
    }));
    try {
      const saved = await command<Settings>("select_project", { project });
      if (ticket === selection.current) {
        expectedProject.current = null;
        apply(saved);
      }
    } catch (error) {
      if (ticket === selection.current) {
        expectedProject.current = null;
        void load();
      }
      throw error;
    } finally {
      if (ticket === selection.current) {
        pending.current = false;
        setSwitching(false);
      }
    }
  };
  const refreshAll = async () => {
    const ticket = revision.current;
    const batch = await command<RefreshBatch>("refresh_all");
    // Snapshot events carry authoritative progress and may arrive before IPC returns.
    if (ticket === revision.current)
      setData((previous) => ({ ...previous, refreshBatch: batch }));
    else await load();
  };
  return {
    data,
    error,
    setError,
    load,
    save,
    select,
    selectProject,
    switching,
    ready,
    refreshAll,
  };
}
