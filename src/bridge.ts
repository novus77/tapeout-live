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
  theme: "light" | "dark";
  followSystemTheme: boolean;
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
  refreshBatch?: RefreshBatch;
};
export type RefreshBatch = {
  busy: boolean;
  entries: {
    resource: string;
    status: "pending" | "refreshed" | "deferred" | "failed" | "cancelled";
    error?: string;
  }[];
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
  theme: "light",
  followSystemTheme: false,
};
export const native = "__TAURI_INTERNALS__" in window;
let previewSettings: Settings = structuredClone(defaults);
let previewBatch: RefreshBatch = { busy: false, entries: [] };
export async function command<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!native) {
    if (name === "refresh_all") {
      previewBatch = {
        busy: false,
        entries: [
          "address",
          "market",
          "network",
          "fab_address",
          "fab_market",
          "fab_network",
        ]
          .filter(
            (resource) =>
              previewSettings.wallet || !resource.endsWith("address"),
          )
          .map((resource) => ({
            resource,
            status: "deferred",
            error: "Browser preview has no live data.",
          })),
      };
      return structuredClone(previewBatch) as T;
    }
    if (name === "update_settings") {
      previewSettings = structuredClone(args.settings as Settings);
      return structuredClone(previewSettings) as T;
    }
    if (name === "select_account") {
      const account = previewSettings.accounts.find(
        (account) => account.address === args.address,
      );
      if (!account) throw new Error("Preview account not found.");
      previewSettings = {
        ...previewSettings,
        wallet: account.address,
        alias: account.name,
      };
      return structuredClone(previewSettings) as T;
    }
    if (name === "select_project") {
      if (args.project !== "bem" && args.project !== "fab")
        throw new Error("Unknown preview project.");
      previewSettings = { ...previewSettings, project: args.project };
      return structuredClone(previewSettings) as T;
    }
    if (name === "get_dashboard")
      return {
        settings: structuredClone(previewSettings),
        address: null,
        market: null,
        network: null,
        jobs: {},
        refreshBatch: structuredClone(previewBatch),
      } as T;
    if (name === "get_history") return [] as T;
    if (
      name === "set_network_visible" ||
      name === "hide_panel" ||
      name === "refresh_resource" ||
      name === "present_panel"
    )
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
