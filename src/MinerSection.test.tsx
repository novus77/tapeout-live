// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { CircuitSection, NetworkSection } from "./MonitorSections";
import { defaults, type Dashboard, type Snapshot } from "./bridge";

afterEach(cleanup);
const snapshot = (fab = false): Snapshot => ({
  resource: fab ? "fab_address" : "address",
  wallet: "0x0000000000000000000000000000000000000001",
  fetchedAt: Date.now() / 1000,
  stale: false,
  data: {
    circuits: [
      {
        processor: "TapeOut",
        processor_address: "cpu-a",
        circuit_id: "11",
        task_id: 24,
        task_name: "Adder",
        status: "active",
        pool: "verified",
        count: 1,
        current_hashrate: "9007199254740992",
        estimated_daily_bem: 0.12,
        estimated_daily: "0.00000001",
        is_champion: 1,
      },
      {
        processor: "TapeOut",
        processor_address: "cpu-b",
        circuit_id: "12",
        task_id: 25,
        task_name: "Comparator",
        status: "unrecognized",
        count: 1,
        current_hashrate: "9007199254740993",
        estimated_daily_bem: 0.3,
        estimated_daily: "0.00000002",
      },
      {
        processor: "TapeOut",
        circuit_id: "13",
        task_name: "Missing",
        count: 1,
      },
    ],
  },
});

it.each(["bem", "fab"] as const)(
  "uses two network cells and exactly one metadata row for %s",
  (project) => {
    const data: Dashboard = {
      settings: { ...defaults, project, language: "en" },
      address: null,
      market: null,
      network: null,
      jobs: {},
    };
    const { container } = render(<NetworkSection data={data} />);
    expect(container.querySelectorAll(".metric")).toHaveLength(2);
    expect(container.querySelectorAll(".network-meta")).toHaveLength(1);
    expect(container.querySelector(".network-meta")?.children).toHaveLength(3);
    expect(
      container.querySelector(".network-meta")?.children[1].textContent,
    ).toContain("Indexed circuits");
    expect(screen.queryByText(/Unverified/)).toBeNull();
    expect(container.querySelector(".source-note")).toBeNull();
  },
);

it.each([false, true])(
  "shows per-row production, native disclosure and precise sorting (FAB=%s)",
  (fab) => {
    const { container } = render(
      <CircuitSection snapshot={snapshot(fab)} language="en" />,
    );
    const entries = container.querySelectorAll("details");
    expect(entries).toHaveLength(3);
    expect(entries[0].textContent).toContain("#12");
    expect(entries[2].textContent).toContain("Missing");
    expect(screen.getByText(fab ? "0.00000001" : "0.12")).toBeTruthy();
    const details = entries[1] as HTMLDetailsElement;
    fireEvent.click(details.querySelector("summary")!);
    expect(details.open).toBe(true);
    expect(within(details).getByText("cpu-a")).toBeTruthy();
    expect(screen.getAllByText("Unknown state")).toHaveLength(2);
    fireEvent.change(screen.getByRole("combobox", { name: "Miner sorting" }), {
      target: { value: "id" },
    });
    expect(container.querySelector("details")?.textContent).toContain("#11");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search task or circuit ID" }),
      { target: { value: "comparator" } },
    );
    expect(container.querySelectorAll("details")).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "no-match" },
    });
    expect(screen.getByText("No matching miners")).toBeTruthy();
  },
);

it("labels grouped rows without inventing per-miner metrics", () => {
  const value = snapshot();
  value.data.circuits = [
    {
      processor: "TapeOut",
      circuit_id: "77",
      circuit_ids: ["77", "78"],
      count: 2,
      task_name: "Grouped",
      current_hashrate: 123456,
      estimated_daily_bem: 33,
    },
  ];
  render(<CircuitSection snapshot={value} language="en" />);
  expect(screen.getByText("Grouped record")).toBeTruthy();
  expect(screen.getByText("77, 78")).toBeTruthy();
  expect(screen.queryByText("123,456")).toBeNull();
  expect(screen.queryByText("33")).toBeNull();
});

it("shows partial coverage and missing FAB weights without replacing summary totals", () => {
  const value = snapshot(true);
  value.data.circuitsComplete = false;
  value.data.circuitCount = 129;
  render(<CircuitSection snapshot={value} language="en" />);
  expect(screen.getByText(/3 \/ 129/)).toBeTruthy();
  expect(screen.getAllByText("Verified weight")).toHaveLength(3);
});

it("distinguishes loading, indexing, empty and filtered results", () => {
  const { rerender } = render(<CircuitSection snapshot={null} language="en" />);
  expect(screen.getByText("Waiting for data")).toBeTruthy();
  const value = snapshot();
  value.data = { circuits: [], pending: true };
  rerender(<CircuitSection snapshot={value} language="en" />);
  expect(screen.getByText("Indexing")).toBeTruthy();
  value.data = { circuits: [] };
  rerender(<CircuitSection snapshot={{ ...value }} language="en" />);
  expect(screen.getByText("No indexed circuits")).toBeTruthy();
});

it("resets query and disclosure when the wallet or project changes", () => {
  const first = snapshot();
  const { container, rerender } = render(
    <CircuitSection snapshot={first} language="en" />,
  );
  fireEvent.click(container.querySelector("summary")!);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Comparator" },
  });
  const second = snapshot(true);
  second.wallet = "0x0000000000000000000000000000000000000002";
  rerender(<CircuitSection snapshot={second} language="en" />);
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  expect(container.querySelectorAll("details[open]")).toHaveLength(0);
  expect(container.querySelectorAll("details")).toHaveLength(3);
});

it("keeps zero production distinct from unavailable values", () => {
  const value = snapshot(true);
  value.data.circuits = [
    {
      processor: "FAB",
      circuit_id: "1",
      status: "inactive",
      current_hashrate: "0",
      estimated_daily: "0",
      is_champion: 0,
    },
  ];
  const { container } = render(
    <CircuitSection snapshot={value} language="zh" />,
  );
  expect(container.querySelector(".miner-values")?.textContent).toBe(
    "0H0FAB / 日",
  );
  expect(screen.getByText("非活跃")).toBeTruthy();
  expect(container.querySelector(".miner-values")?.textContent).not.toContain(
    "—",
  );
});
