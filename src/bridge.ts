import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Row } from "./metrics";
import type { Language } from "./i18n";
export type Account = { address: string; name: string };
export type Project = "bem" | "fab";
export type Settings = {
  wallet: string;
  alias: string;
  interval: number;
  notifications: boolean;
  autostart: boolean;
  pinned: boolean;
  powerDrop: number;
  accounts: Account[];
  language: Language;
  project: Project;
};
export type Snapshot = {
  resource: string;
  wallet?: string;
  fetchedAt: number;
  observedAt?: string;
  generatedAt?: string;
  observedBlock?: number;
  confirmedBlock?: number;
  stale: boolean;
  data: Record<string, unknown>;
};
export type Job = {
  busy: boolean;
  error?: string;
  nextAt: number;
  terminal: boolean;
};
export type Dashboard = {
  settings: Settings;
  address: Snapshot | null;
  market: Snapshot | null;
  network: Snapshot | null;
  jobs: Record<string, Job>;
};
export const defaults: Settings = {
  wallet: "",
  alias: "",
  interval: 60,
  notifications: false,
  autostart: false,
  pinned: false,
  powerDrop: 10,
  accounts: [],
  language: "zh",
  project: "bem",
};
export const native = "__TAURI_INTERNALS__" in window;
export async function command<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!native) {
    if (name === "get_dashboard")
      return {
        settings: defaults,
        address: null,
        market: null,
        network: null,
        jobs: {},
      } as T;
    if (name === "get_history") return [] as T;
    if (name === "set_network_visible" || name === "hide_panel")
      return undefined as T;
    throw new Error("Run the desktop application to connect to TapeOutScan.");
  }
  return invoke<T>(name, args);
}
export const onSnapshot = (callback: () => void) =>
  native ? listen("snapshot_updated", callback) : Promise.resolve(() => {});
export const object = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
export const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((v) => v && typeof v === "object") : [];
