// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  renderHook,
  act,
} from "@testing-library/react";
import App from "./App";
import { defaults, type Dashboard, type Settings } from "./bridge";
import { useMonitor } from "./useMonitor";
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
  expect(container.querySelector("#network-title svg")).toBeNull();
  expect(container.querySelector("#overview-title svg")).toBeNull();
  expect(container.querySelector(".metric-label svg")).toBeNull();
  expect(container.querySelector("nav")).toBeNull();
  expect(container.querySelector("footer")).toBeNull();
  expect(container.querySelector("a")).toBeNull();
  expect(screen.queryByText("BSC")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Quit|Hide panel|回退/ }),
  ).toBeNull();
});
it("opens ordered auto-saving preferences and retains values after failure", async () => {
  setup();
  const { container } = render(<App />);
  await screen.findByText("111");
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  expect(
    [...container.querySelectorAll(".preference-row strong")].map(
      (el) => el.textContent,
    ),
  ).toEqual([
    "主题",
    "语言",
    "开机启动",
    "跟随系统主题",
    "刷新频率",
    "保持面板展开",
  ]);
  const original = mock.command.getMockImplementation()!;
  mock.command.mockImplementation(
    (name: string, args?: Record<string, unknown>) =>
      name === "update_settings"
        ? Promise.reject(new Error("Startup failed"))
        : original(name, args),
  );
  fireEvent.click(screen.getByRole("switch", { name: "开机启动" }));
  await screen.findByRole("alert");
  expect(
    screen
      .getByRole("switch", { name: "开机启动" })
      .getAttribute("aria-checked"),
  ).toBe("false");
});
it("adds and selects an account inline, cancels without writing, and confirms removal", async () => {
  setup();
  render(<App />);
  await screen.findByText("111");
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  fireEvent.click(screen.getByRole("button", { name: "添加账户" }));
  fireEvent.change(
    screen.getAllByRole("textbox", { name: "账户名称" }).at(-1)!,
    {
      target: { value: "Gamma" },
    },
  );
  fireEvent.change(screen.getByRole("textbox", { name: "钱包地址" }), {
    target: { value: "0x0000000000000000000000000000000000000003" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "保存账户" }).at(-1)!);
  await screen.findByText("Gamma");
  expect((mock.dashboard as Dashboard).settings.wallet).toBe(
    "0x0000000000000000000000000000000000000003",
  );
  fireEvent.click(screen.getByRole("button", { name: "添加账户" }));
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.queryByRole("textbox", { name: "钱包地址" })).toBeNull();
  fireEvent.click(screen.getByText("编辑账户 Gamma"));
  fireEvent.click(screen.getByRole("button", { name: "移除 Gamma" }));
  expect((mock.dashboard as Dashboard).settings.accounts).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "确认移除" }));
  await waitFor(() =>
    expect((mock.dashboard as Dashboard).settings.accounts).toHaveLength(2),
  );
});
it("switches accounts and locale in the same page", async () => {
  setup();
  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "选择账户" });
  fireEvent.change(selector, { target: { value: second } });
  await waitFor(() => expect(screen.getByText("222")).toBeTruthy());
  expect(screen.queryByText("111")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  await screen.findByRole("button", { name: "Settings" });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  await screen.findByRole("heading", { name: "Network" });
  expect(screen.getByRole("heading", { name: "My mining" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
});
it("rejects duplicate addresses case-insensitively and overlong Unicode names", async () => {
  setup();
  render(<App />);
  await screen.findByText("111");
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  fireEvent.click(screen.getByRole("button", { name: "添加账户" }));
  fireEvent.change(screen.getByRole("textbox", { name: "钱包地址" }), {
    target: { value: first.toUpperCase() },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "保存账户" }).at(-1)!);
  await screen.findByText("该钱包已在账户列表中。");
  fireEvent.change(screen.getByRole("textbox", { name: "钱包地址" }), {
    target: { value: "0x0000000000000000000000000000000000000003" },
  });
  fireEvent.change(
    screen.getAllByRole("textbox", { name: "账户名称" }).at(-1)!,
    { target: { value: "😀".repeat(41) } },
  );
  fireEvent.click(screen.getAllByRole("button", { name: "保存账户" }).at(-1)!);
  await screen.findByText("账户名称最多 40 个字符。");
  expect((mock.dashboard as Dashboard).settings.accounts).toHaveLength(2);
});
it("clears the legacy alias when the last account is removed", async () => {
  setup();
  const data = mock.dashboard as Dashboard;
  data.settings.accounts = data.settings.accounts.slice(0, 1);
  data.settings.alias = "Alpha";
  render(<App />);
  await screen.findByText("111");
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  fireEvent.click(screen.getByText("编辑账户 Alpha"));
  fireEvent.click(screen.getByRole("button", { name: "移除 Alpha" }));
  fireEvent.click(screen.getByRole("button", { name: "确认移除" }));
  await waitFor(() => expect(data.settings.wallet).toBe(""));
  expect(data.settings.alias).toBe("");
});
it("synchronously gates rapid settings mutations and preserves data on failure", async () => {
  setup();
  const { result } = renderHook(useMonitor);
  await waitFor(() => expect(result.current.ready).toBe(true));
  const before = result.current.data.settings;
  const original = mock.command.getMockImplementation()!;
  let reject: ((reason: unknown) => void) | undefined;
  mock.command.mockImplementation(
    (name: string, args?: Record<string, unknown>) =>
      name === "update_settings"
        ? new Promise((_resolve, fail) => {
            reject = fail;
          })
        : original(name, args),
  );
  let firstSave: Promise<Settings>;
  await act(async () => {
    firstSave = result.current.save({ ...before, theme: "dark" });
    await expect(
      result.current.save({ ...before, language: "en" }),
    ).rejects.toThrow("already pending");
  });
  expect(
    mock.command.mock.calls.filter(([name]) => name === "update_settings"),
  ).toHaveLength(1);
  await act(async () => {
    reject?.(new Error("Persistence failed"));
    await expect(firstSave!).rejects.toThrow("Persistence failed");
  });
  expect(result.current.data.settings).toEqual(before);
  expect(result.current.switching).toBe(false);
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
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  await screen.findByRole("button", { name: "Settings" });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
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
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  await screen.findByRole("button", { name: "Settings" });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
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
