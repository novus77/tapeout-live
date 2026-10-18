// @vitest-environment jsdom
import { expect, it } from "vitest";
import { compareMetric, groupedMiner, visibleMinerSnapshot } from "./minerData";
import { defaults, type Dashboard } from "./bridge";

it("compares exact decimals and puts missing metrics last in both directions", () => {
  expect(compareMetric("9007199254740993", "9007199254740992")).toBe(-1);
  expect(compareMetric("0.00000002", "0.00000001")).toBe(-1);
  expect(compareMetric("1.0", 1)).toBe(0);
  expect(compareMetric(null, "0")).toBe(1);
  expect(compareMetric("0", "-1")).toBe(-1);
  expect(compareMetric("11", "12", true)).toBe(-1);
  expect(compareMetric(undefined, "12", true)).toBe(1);
});

it("does not flatten groups or accept cross-project and cross-wallet snapshots", () => {
  expect(groupedMiner({ count: 2 })).toBe(true);
  expect(groupedMiner({ circuit_ids: ["1", "2"] })).toBe(true);
  expect(groupedMiner({ count: 1 })).toBe(false);
  const wallet = "0x0000000000000000000000000000000000000001";
  const data: Dashboard = {
    settings: {
      ...defaults,
      wallet,
      accounts: [{ address: wallet, name: "A", projects: ["bem"] }],
    },
    address: {
      resource: "address",
      wallet,
      fetchedAt: 0,
      stale: false,
      data: {},
    },
    network: null,
    market: null,
    jobs: {},
  };
  expect(visibleMinerSnapshot(data)).toBe(data.address);
  expect(
    visibleMinerSnapshot({
      ...data,
      address: { ...data.address!, wallet: "other" },
    }),
  ).toBeNull();
  expect(
    visibleMinerSnapshot({
      ...data,
      settings: { ...data.settings, project: "fab" },
    }),
  ).toBeNull();
  expect(
    visibleMinerSnapshot({
      ...data,
      address: { ...data.address!, resource: "fab_address" },
    }),
  ).toBeNull();
});
