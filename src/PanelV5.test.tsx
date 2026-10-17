// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { defaults, type Dashboard } from "./bridge";
import { WalletSection, NetworkSection } from "./MonitorSections";
import { SettingsPanel } from "./SettingsPanel";
import { PowerHistory } from "./PowerHistory";
const ipc = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("./bridge", async (original) => ({
  ...(await original<typeof import("./bridge")>()),
  command: ipc,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const first = "0x0000000000000000000000000000000000000001";
const second = "0x0000000000000000000000000000000000000002";
function fixture(project: "bem" | "fab" = "bem"): Dashboard {
  return {
    settings: {
      ...defaults,
      language: "en",
      project,
      wallet: first,
      accounts: [
        { name: "Alpha", address: first },
        { name: "Beta", address: second },
      ],
    },
    address: {
      resource: project === "fab" ? "fab_address" : "address",
      wallet: first,
      fetchedAt: Date.now() / 1000,
      stale: false,
      data: {
        summary: {},
        assets: {
          token: "12345",
          bem: "34567",
          bnb: "45678",
          observed_at: "2026-10-16T12:00:00Z",
        },
      },
    },
    market: null,
    network: null,
    jobs: {},
  };
}
it.each(["bem", "fab"] as const)(
  "supports keyboard and outside dismissal for the shared %s selector",
  async (project) => {
    const select = vi.fn().mockResolvedValue(undefined);
    render(
      <WalletSection
        data={fixture(project)}
        select={select}
        onError={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: "Choose account: Alpha",
    });
    expect(trigger.textContent).toBe("Alpha");
    fireEvent.keyDown(trigger, { key: "Enter" });
    const options = screen.getAllByRole("option");
    expect(document.activeElement).toBe(options[0]);
    fireEvent.keyDown(options[0], { key: "End" });
    expect(document.activeElement).toBe(options[1]);
    fireEvent.keyDown(options[1], { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getAllByRole("option")[0], { key: "ArrowDown" });
    await act(async () =>
      fireEvent.keyDown(screen.getAllByRole("option")[1], { key: " " }),
    );
    expect(select).toHaveBeenCalledWith(second);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  },
);
it("keeps twenty accounts and full long names accessible with unnamed fallback", () => {
  const data = fixture();
  data.settings.accounts = Array.from({ length: 20 }, (_, i) => ({
    address: `0x${String(i).padStart(40, "0")}`,
    name: i ? "" : "😀".repeat(40),
  }));
  data.settings.wallet = data.settings.accounts[0].address;
  render(<WalletSection data={data} select={vi.fn()} onError={vi.fn()} />);
  fireEvent.click(
    screen.getByRole("button", { name: `Choose account: ${"😀".repeat(40)}` }),
  );
  expect(screen.getAllByRole("option")).toHaveLength(20);
  expect(
    screen.getByRole("option", {
      name: `Account 20 ${data.settings.accounts[19].address}`,
    }),
  ).toBeTruthy();
});
it("uses sibling edit actions and an explicit cancellable readonly-address editor", async () => {
  const data = fixture(),
    save = vi.fn().mockResolvedValue(data.settings);
  const { container } = render(
    <SettingsPanel
      settings={data.settings}
      save={save}
      select={vi.fn()}
      disabled={false}
      effectiveTheme="light"
    />,
  );
  expect(container.querySelector("details")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Edit account Alpha" }));
  expect(
    (
      screen.getByRole("textbox", {
        name: "Wallet address",
      }) as HTMLInputElement
    ).readOnly,
  ).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Account name" }), {
    target: { value: "Renamed" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "中文" })).toBeTruthy();
  expect(screen.getByText("|")).toBeTruthy();
});
it("does not relabel legacy FAB holdings and keeps source rows removed", () => {
  const data = fixture("fab");
  const { container } = render(
    <>
      <NetworkSection data={data} />
      <WalletSection data={data} select={vi.fn()} onError={vi.fn()} />
    </>,
  );
  const cells = container.querySelector(".balance-row")!;
  expect(within(cells as HTMLElement).getByText("BEM balance")).toBeTruthy();
  expect(within(cells as HTMLElement).getByText("OKB balance")).toBeTruthy();
  expect(cells.textContent).not.toMatch(/12345|34567|45678/);
  expect(screen.getAllByTitle("TapeOutScan balance unavailable")).toHaveLength(
    2,
  );
  expect(container.querySelector(".source-note")).toBeNull();
  expect(screen.queryByText("Asset snapshot")).toBeNull();
});
it("retains BEM network time and independent accessible balance observation age", () => {
  const data = fixture();
  const { container } = render(
    <>
      <NetworkSection data={data} />
      <WalletSection data={data} select={vi.fn()} onError={vi.fn()} />
    </>,
  );
  expect(container.querySelectorAll(".source-note")).toHaveLength(1);
  const balances = container.querySelectorAll(".balance-row > span");
  expect(balances[0].getAttribute("aria-description")).toContain(
    "Delayed data",
  );
  expect(balances[0].getAttribute("aria-description")).toContain("2026");
});
it("keeps one provider point and its raw precision while collecting", () => {
  const data = fixture();
  data.address!.data.hashrateHistory = {
    points: [{ time: Date.now() / 1000 - 10, value: "9007199254740993" }],
  };
  render(<PowerHistory data={data} />);
  expect(screen.getByText("9007199254740993 H")).toBeTruthy();
  expect(screen.getByText("Collecting history")).toBeTruthy();
  expect(screen.queryByRole("slider")).toBeNull();
  expect(document.querySelector("polyline")).toBeNull();
});
it("inspects irregular time points by keyboard and pointer with real values", () => {
  const data = fixture(),
    now = Date.now() / 1000;
  data.address!.data.hashrateHistory = {
    points: [
      { time: now - 100, value: "0" },
      { time: now - 99, value: "5" },
      { time: now, value: "10" },
    ],
  };
  render(<PowerHistory data={data} />);
  const chart = screen.getByRole("slider", { name: "Power history" });
  fireEvent.keyDown(chart, { key: "Home" });
  expect(chart.getAttribute("aria-valuetext")).toContain("0 H");
  fireEvent.keyDown(chart, { key: "ArrowRight" });
  expect(chart.getAttribute("aria-valuetext")).toContain("5 H");
  vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
    left: 20,
    top: 0,
    width: 380,
    height: 72,
    right: 400,
    bottom: 72,
    x: 20,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.keyDown(chart, { key: "End" });
  fireEvent(
    chart,
    new MouseEvent("pointermove", { bubbles: true, clientX: 90 }),
  );
  expect(chart.getAttribute("aria-valuetext")).toContain("5 H");
  expect(screen.getAllByText("5 H").length).toBeGreaterThan(0);
});

it("resets inspection after leaving and returning to a wallet", () => {
  const data = fixture(),
    now = Date.now() / 1000;
  data.address!.data.hashrateHistory = {
    points: [
      { time: now - 10, value: "1" },
      { time: now, value: "2" },
    ],
  };
  const { rerender } = render(<PowerHistory data={data} />);
  fireEvent.keyDown(screen.getByRole("slider"), { key: "Home" });
  rerender(
    <PowerHistory
      data={{ ...data, settings: { ...data.settings, wallet: second } }}
      suspended
    />,
  );
  rerender(<PowerHistory data={data} />);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toContain(
    "2 H",
  );
});

it("renders one actual flat-series axis label with an interior padded line", () => {
  const data = fixture(),
    now = Date.now() / 1000;
  data.address!.data.hashrateHistory = {
    points: [
      { time: now - 10, value: "0" },
      { time: now, value: "0" },
    ],
  };
  const { container } = render(<PowerHistory data={data} />);
  expect(container.querySelectorAll(".chart-axis")).toHaveLength(1);
  expect(container.querySelector("polyline")?.getAttribute("points")).toBe(
    "66,36 374,36",
  );
});

it("keeps the editor open on save failure and enforces Unicode rename limits", async () => {
  const data = fixture(),
    save = vi.fn().mockRejectedValue(new Error("Persistence failed"));
  render(
    <SettingsPanel
      settings={data.settings}
      save={save}
      select={vi.fn()}
      disabled={false}
      effectiveTheme="light"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit account Alpha" }));
  const input = screen.getByRole("textbox", { name: "Account name" });
  fireEvent.change(input, { target: { value: "😀".repeat(41) } });
  fireEvent.click(screen.getByRole("button", { name: "Save account" }));
  expect(save).not.toHaveBeenCalled();
  await screen.findByText("Use at most 40 characters for an account name.");
  fireEvent.change(input, { target: { value: "Renamed" } });
  fireEvent.click(screen.getByRole("button", { name: "Save account" }));
  await screen.findByText("Persistence failed");
  expect((input as HTMLInputElement).value).toBe("Renamed");
  expect(save.mock.calls[0][0]).toMatchObject({
    wallet: first,
    alias: "Renamed",
    accounts: [
      { name: "Renamed", address: first },
      { name: "Beta", address: second },
    ],
  });
});

it("preserves the selected account after rejection and blocks a pending selection", async () => {
  const data = fixture(),
    fail = vi.fn();
  let reject: ((value: unknown) => void) | undefined;
  const select = vi.fn(
    () =>
      new Promise<void>((_done, no) => {
        reject = no;
      }),
  );
  render(<WalletSection data={data} select={select} onError={fail} />);
  const trigger = screen.getByRole("button", {
    name: "Choose account: Alpha",
  }) as HTMLButtonElement;
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: `Beta ${second}` }));
  expect(trigger.disabled).toBe(true);
  await act(async () => reject?.(new Error("Selection failed")));
  expect(trigger.disabled).toBe(false);
  expect(trigger.textContent).toBe("Alpha");
  expect(fail).toHaveBeenCalledWith("Error: Selection failed");
});
