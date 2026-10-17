// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { defaults, type Dashboard } from "./bridge";
import { historyPoints, PowerHistory } from "./PowerHistory";
const mock = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock("./bridge", async (original) => ({
  ...(await original<typeof import("./bridge")>()),
  command: mock.command,
}));
afterEach(cleanup);
it("filters to valid sorted samples within the last 24 hours", () => {
  const now = Date.now();
  expect(
    historyPoints(
      [
        { at: now / 1000, power: 2 },
        { at: (now - 1000) / 1000, power: "1" },
        { at: (now - 90000000) / 1000, power: 8 },
        { at: now / 1000, power: -1 },
        { at: "bad", power: 2 },
      ],
      now,
    ).map((p) => p.power),
  ).toEqual([1, 2]);
});
it("discards a late previous-account history and never draws fewer than two samples", async () => {
  let resolve: ((value: unknown[]) => void) | undefined;
  mock.command
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue([]);
  const data: Dashboard = {
    settings: { ...defaults, wallet: "first" },
    address: null,
    market: null,
    network: null,
    jobs: {},
  };
  const { rerender } = render(<PowerHistory data={data} />);
  rerender(
    <PowerHistory
      data={{ ...data, settings: { ...data.settings, wallet: "second" } }}
    />,
  );
  await act(async () =>
    resolve?.([
      { time: Date.now() / 1000 - 10, value: "5" },
      { time: Date.now() / 1000, value: "7" },
    ]),
  );
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("正在积累趋势")).toBeTruthy();
});
it("does not request local history until native selection has completed", () => {
  mock.command.mockClear();
  const data: Dashboard = {
    settings: { ...defaults, wallet: "pending" },
    address: null,
    market: null,
    network: null,
    jobs: {},
  };
  render(<PowerHistory data={data} suspended />);
  expect(mock.command).not.toHaveBeenCalled();
});
