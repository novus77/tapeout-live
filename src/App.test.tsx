// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "./App";
import { defaults, type Dashboard, type Settings } from "./bridge";
const mock = vi.hoisted(() => ({
  dashboard: null as unknown,
  command: vi.fn(),
  updated: null as null | (() => void),
}));
vi.mock("./bridge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./bridge")>();
  return {
    ...actual,
    native: true,
    command: mock.command,
    onSnapshot: async (callback: () => void) => {
      mock.updated = callback;
      return () => {
        mock.updated = null;
      };
    },
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const first = "0x0000000000000000000000000000000000000001",
  second = "0x0000000000000000000000000000000000000002";
function setup() {
  mock.dashboard = {
    settings: {
      ...defaults,
      wallet: first,
      accounts: [
        { address: first, name: "Alpha" },
        { address: second, name: "Beta" },
      ],
    },
    address: {
      resource: "address",
      fetchedAt: Date.now() / 1000,
      observedAt: new Date().toISOString(),
      stale: false,
      data: { summary: { miner_count: 0, total_hashrate: 111 }, circuits: [] },
    },
    market: null,
    network: null,
    jobs: {},
  } satisfies Dashboard;
  mock.command.mockImplementation(
    async (name: string, args?: Record<string, unknown>) => {
      const data = mock.dashboard as Dashboard;
      if (name === "get_dashboard") return structuredClone(data);
      if (name === "update_settings") {
        data.settings = args?.settings as Settings;
        return data.settings;
      }
      if (name === "select_account") {
        data.settings = { ...data.settings, wallet: String(args?.address) };
        data.address = {
          ...data.address!,
          data: {
            summary: { miner_count: 0, total_hashrate: 222 },
            circuits: [],
          },
        };
        return data.settings;
      }
      return undefined;
    },
  );
}
it("renders network above the selected wallet without tabs or external controls", async () => {
  setup();
  const { container } = render(<App />);
  await screen.findByDisplayValue("Alpha · 0x0000…0001");
  const headings = screen
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent);
  expect(headings.slice(0, 2)).toEqual(["全网概览", "我的矿机"]);
  expect(container.querySelector("nav")).toBeNull();
  expect(container.querySelector("footer")).toBeNull();
  expect(container.querySelector("a")).toBeNull();
  expect(screen.queryByText("BSC")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Quit|Hide panel|回退/ }),
  ).toBeNull();
});
it("switches accounts and locale in the same page", async () => {
  setup();
  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "选择账户" });
  fireEvent.change(selector, { target: { value: second } });
  await waitFor(() => expect(screen.getByText("222")).toBeTruthy());
  expect(screen.queryByText("111")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  await screen.findByRole("heading", { name: "Network" });
  expect(screen.getByRole("heading", { name: "My mining" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
});

it("clears the previous wallet while a switch is awaiting native confirmation", async () => {
  setup();
  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "选择账户" });
  const original = mock.command.getMockImplementation()!;
  let complete: (() => void) | undefined;
  mock.command.mockImplementation(
    (name: string, args?: Record<string, unknown>) =>
      name === "select_account"
        ? new Promise((resolve) => {
            complete = () => resolve(original(name, args));
          })
        : original(name, args),
  );
  fireEvent.change(selector, { target: { value: second } });
  try {
    expect(screen.queryByText("111")).toBeNull();
  } finally {
    complete?.();
  }
  await screen.findByText("222");
});

it("switches the complete dashboard to FAB without showing old BEM metrics", async () => {
  setup();
  render(<App />);
  await screen.findByText("111");
  const original = mock.command.getMockImplementation()!;
  let complete: (() => void) | undefined;
  mock.command.mockImplementation(
    (name: string, args?: Record<string, unknown>) => {
      if (name === "select_project")
        return new Promise((resolve) => {
          complete = () => {
            const data = mock.dashboard as Dashboard;
            data.settings = { ...data.settings, project: "fab" };
            data.address = {
              ...data.address!,
              resource: "fab_address",
              data: {
                summary: {
                  miner_count: "2",
                  active: "1",
                  optimal: "1",
                  total_hashrate: "333",
                  estimated_daily: "0.00000001",
                },
                assets: { token: "0.12345678" },
                circuits: [],
                circuitCount: 2,
                circuitsComplete: false,
              },
            };
            resolve(data.settings);
          };
        });
      return original(name, args);
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "FAB" }));
  expect(screen.queryByText("111")).toBeNull();
  mock.updated?.();
  await waitFor(() => expect(screen.queryByText("111")).toBeNull());
  complete?.();
  await screen.findByText("333");
  expect(screen.getByText("FAB 余额")).toBeTruthy();
  expect(screen.queryByText("BNB 余额")).toBeNull();
  expect(screen.getByText("0.12345678")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "FAB" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  await screen.findByText("FAB balance");
});

it("retains FAB selection while switching accounts and locale", async () => {
  setup();
  const data = mock.dashboard as Dashboard;
  data.settings.project = "fab";
  data.address!.resource = "fab_address";
  data.address!.data.summary = {
    miner_count: "0",
    total_hashrate: "111",
    estimated_daily: "0.00000001",
    active: "0",
    optimal: "0",
  };
  render(<App />);
  await screen.findByText("0.00000001");
  fireEvent.change(screen.getByRole("combobox", { name: "选择账户" }), {
    target: { value: second },
  });
  await screen.findByText("222");
  expect((mock.dashboard as Dashboard).settings.project).toBe("fab");
  expect(
    screen.getByRole("button", { name: "FAB" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  await screen.findByText("FAB balance");
  expect(screen.queryByText("BEM balance")).toBeNull();
});

it("distinguishes FAB indexing from an indexed empty wallet", async () => {
  setup();
  const data = mock.dashboard as Dashboard;
  data.settings.project = "fab";
  data.address!.resource = "fab_address";
  data.address!.data = { pending: true, summary: null, circuits: [] };
  render(<App />);
  await screen.findAllByText("正在索引");
  expect(screen.queryByText("暂无已收录矿机")).toBeNull();
  expect(screen.queryByText("111")).toBeNull();
});
