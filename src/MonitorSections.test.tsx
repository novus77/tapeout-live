// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  ActivitySection,
  activityEvent,
  mergedActivity,
} from "./MonitorSections";
import type { Snapshot } from "./bridge";

afterEach(cleanup);

// Shapes copied from the real v2 tapeout responses saved in results/:
// address-detail activity rows carry event_type + log_index and several share a
// block; address-token rows carry kind + transaction_index and no log_index.
const activityRow = (block: number, log: number, event: string, task = 34) => ({
  operation_id: `event:0x${block}${log}:behemoth:2510:${event.toLowerCase()}`,
  tx_hash: `0x${block}${log}`,
  block_number: block,
  log_index: log,
  block_time: "2026-10-15T03:59:05+00:00",
  task_id: task,
  task_name: "Adder",
  event_type: event,
});
const tokenRow = (block: number, index: number, kind: string) => ({
  operation_id: `bem:0x${block}${index}`,
  tx_hash: `0x${block}${index}`,
  block_number: block,
  transaction_index: index,
  block_time: "2026-10-20T07:59:46+00:00",
  kind,
  amountRaw: "14275000000",
  direction: "out",
});
const snapshot = (data: Record<string, unknown>): Snapshot => ({
  resource: "address",
  wallet: "0x0000000000000000000000000000000000000001",
  fetchedAt: Date.now() / 1000,
  stale: false,
  data,
});
const labels = () =>
  [...document.querySelectorAll(".activity-row strong")].map(
    (n) => n.textContent,
  );

it("merges token activity back into the newest five rows", () => {
  // 1) only activity: v2 address-detail alone, which lost every BEM sale.
  const onlyActivity = mergedActivity({
    rows: [activityRow(900, 1, "Start"), activityRow(950, 2, "Demoted")],
  });
  expect(onlyActivity).toHaveLength(2);

  render(
    <ActivitySection
      snapshot={snapshot({
        activity: { rows: [activityRow(900, 1, "Start")] },
      })}
      language="en"
    />,
  );
  expect(screen.getByText("Started")).toBeTruthy();
  cleanup();

  // 2) only token activity: the side endpoint answered but there are no
  //    circuit events; the sales must still show.
  render(
    <ActivitySection
      snapshot={snapshot({
        activity: { rows: [] },
        tokenActivity: { rows: [tokenRow(1000, 3, "BEMSell")] },
        tokenActivityUnavailable: false,
      })}
      language="en"
    />,
  );
  expect(screen.getByText("BEM sold")).toBeTruthy();
  expect(screen.queryByText("No recent indexed events")).toBeNull();
  cleanup();

  // 3) both sources, with the same event duplicated in each: it appears once.
  const shared = activityRow(990, 7, "TapeOut");
  const both = mergedActivity(
    { rows: [shared, activityRow(980, 2, "Demoted")] },
    { rows: [{ ...shared }, tokenRow(1000, 3, "BEMSell")] },
  );
  expect(both).toHaveLength(3);
  render(
    <ActivitySection
      snapshot={snapshot({
        activity: { rows: [shared, activityRow(980, 2, "Demoted")] },
        tokenActivity: { rows: [{ ...shared }, tokenRow(1000, 3, "BEMSell")] },
      })}
      language="en"
    />,
  );
  expect(document.querySelectorAll(".activity-row")).toHaveLength(3);
  expect(screen.getAllByText("Tapeout created")).toHaveLength(1);
  expect(screen.getByText("BEM sold")).toBeTruthy();
  expect(labels()).toEqual([
    "BEM sold",
    "Tapeout created",
    "Optimal position lost",
  ]);
  cleanup();

  // 4) both empty: honest empty state, no crash and no blank panel.
  render(
    <ActivitySection
      snapshot={snapshot({
        activity: { rows: [] },
        tokenActivity: { rows: [] },
        tokenActivityUnavailable: false,
      })}
      language="en"
    />,
  );
  expect(screen.getByText("No recent indexed events")).toBeTruthy();
});

it("tolerates a missing or null tokenActivity from a backend without it", () => {
  for (const data of [
    { activity: { rows: [activityRow(900, 1, "Start")] } },
    { activity: { rows: [activityRow(900, 1, "Start")] }, tokenActivity: null },
    { activity: { rows: [activityRow(900, 1, "Start")] }, tokenActivity: {} },
  ]) {
    render(<ActivitySection snapshot={snapshot(data)} language="en" />);
    expect(screen.getByText("Started")).toBeTruthy();
    expect(
      screen.queryByText("Token activity temporarily unavailable"),
    ).toBeNull();
    cleanup();
  }
  // A failed side request is not "this wallet has no sales".
  render(
    <ActivitySection
      snapshot={snapshot({
        activity: { rows: [] },
        tokenActivity: { rows: [] },
        tokenActivityUnavailable: true,
      })}
      language="en"
    />,
  );
  expect(
    screen.getByText("Token activity temporarily unavailable"),
  ).toBeTruthy();
  expect(screen.queryByText("No recent indexed events")).toBeNull();
});

it("sorts both sources together and keeps only the newest five", () => {
  const merged = mergedActivity(
    {
      rows: [
        activityRow(10, 1, "Start"),
        activityRow(30, 1, "Demoted"),
        activityRow(50, 1, "TapeOut"),
      ],
    },
    {
      rows: [
        tokenRow(20, 4, "BEMSell"),
        tokenRow(40, 5, "BEMBuy"),
        tokenRow(60, 6, "BEMTransfer"),
      ],
    },
  );
  expect(merged.map((row) => row.block_number)).toEqual([60, 50, 40, 30, 20]);
});

it("reads the event name from kind or event_type and never renders a bare key", () => {
  expect(activityEvent({ kind: "BEMSell" })).toBe("BEMSell");
  expect(activityEvent({ event_type: "Demoted" })).toBe("Demoted");
  expect(activityEvent({ kind: "SomethingNew" })).toBe("SomethingNew");
  expect(activityEvent({})).toBe("");

  render(
    <ActivitySection
      snapshot={snapshot({
        activity: { rows: [{ ...activityRow(900, 1, "Demoted") }] },
        tokenActivity: { rows: [tokenRow(1000, 3, "SomethingNew")] },
      })}
      language="en"
    />,
  );
  // Unknown kinds fall back to a translated generic label, not the raw key.
  expect(screen.getByText("Wallet event")).toBeTruthy();
  expect(screen.queryByText("SomethingNew")).toBeNull();
  expect(screen.queryByText("unknownEvent")).toBeNull();
  cleanup();

  render(
    <ActivitySection
      snapshot={snapshot({
        tokenActivity: {
          rows: [
            tokenRow(1000, 1, "BEMSell"),
            tokenRow(1000, 2, "BEMBuy"),
            tokenRow(1000, 3, "BEMTransfer"),
            tokenRow(1000, 4, "BEMLiquidityAdd"),
            tokenRow(1000, 5, "BEMLiquidityRemove"),
          ],
        },
      })}
      language="zh"
    />,
  );
  expect(screen.getByText("卖出 BEM")).toBeTruthy();
  expect(screen.getByText("买入 BEM")).toBeTruthy();
  expect(screen.getByText("BEM 转账")).toBeTruthy();
  expect(screen.getByText("添加流动性")).toBeTruthy();
  expect(screen.getByText("移除流动性")).toBeTruthy();
});
