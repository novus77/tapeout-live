// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  defaults,
  settingsForProject,
  type Dashboard,
  type Settings,
} from "./bridge";
import { WalletSection } from "./MonitorSections";
import { AccountManager } from "./AccountManager";

afterEach(cleanup);
const first = "0x0000000000000000000000000000000000000001";
const second = "0x0000000000000000000000000000000000000002";
const third = "0x0000000000000000000000000000000000000003";
const settings: Settings = {
  ...defaults,
  language: "en",
  wallet: first,
  accounts: [
    { address: first, name: "BEM only", projects: ["bem"] },
    { address: second, name: "FAB only", projects: ["fab"] },
    { address: third, name: "Both", projects: ["bem", "fab"] },
  ],
};

it.each(["bem", "fab"] as const)(
  "filters the %s selector and includes shared accounts",
  (project) => {
    const data: Dashboard = {
      settings: settingsForProject(settings, project),
      address: null,
      network: null,
      market: null,
      jobs: {},
    };
    render(<WalletSection data={data} select={vi.fn()} onError={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `Choose account: ${project.toUpperCase()} only`,
      }),
    );
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("option", { name: `Both ${third}` })).toBeTruthy();
    expect(
      screen.queryByRole("option", {
        name: `${project === "bem" ? "FAB" : "BEM"} only ${project === "bem" ? second : first}`,
      }),
    ).toBeNull();
  },
);

it("clears an incompatible selection and hides stale metrics when no account matches", () => {
  const next = settingsForProject(
    { ...settings, accounts: settings.accounts.slice(0, 1) },
    "fab",
  );
  expect(next.wallet).toBe("");
  expect(next.alias).toBe("");
  const data: Dashboard = {
    settings: next,
    address: {
      resource: "address",
      fetchedAt: 0,
      stale: false,
      data: { summary: { total_hashrate: "999" } },
    },
    network: null,
    market: null,
    jobs: {},
  };
  render(<WalletSection data={data} select={vi.fn()} onError={vi.fn()} />);
  expect(screen.getByText("No account for this project")).toBeTruthy();
  expect(screen.queryByText("999")).toBeNull();
});

it("preserves legacy and dual-project selections while switching project", () => {
  expect(settingsForProject({ ...settings, wallet: third }, "fab").wallet).toBe(
    third,
  );
  const legacy = {
    ...settings,
    accounts: [{ address: first, name: "Legacy" }],
  };
  expect(settingsForProject(legacy, "fab").wallet).toBe(first);
});

it("requires a project when adding and switches to an exclusively FAB account", async () => {
  const save = vi.fn(async (next: Settings) => next);
  render(
    <AccountManager
      settings={{ ...settings, accounts: [], wallet: "" }}
      save={save}
      select={vi.fn()}
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add account" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Account name" }), {
    target: { value: "New FAB" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Wallet address" }), {
    target: { value: second },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "BEM" }));
  fireEvent.click(screen.getByRole("button", { name: "Save account" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Select at least one mining project.",
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: "FAB" }));
  fireEvent.click(screen.getByRole("button", { name: "Save account" }));
  await screen.findByRole("button", { name: "Add account" });
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      project: "fab",
      wallet: second,
      accounts: [{ address: second, name: "New FAB", projects: ["fab"] }],
    }),
  );
});

it("editing project tags reconciles the selected wallet and preserves all accounts", async () => {
  function Harness() {
    const [value, setValue] = useState(settings);
    return (
      <>
        <AccountManager
          settings={value}
          save={async (next) => {
            setValue(next);
            return next;
          }}
          select={async () => {}}
          disabled={false}
        />
        <output aria-label="Selected wallet">{value.wallet}</output>
      </>
    );
  }
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Edit account BEM only" }),
  );
  const group = screen.getByRole("group", { name: "Mining projects" });
  fireEvent.click(within(group).getByRole("checkbox", { name: "BEM" }));
  fireEvent.click(within(group).getByRole("checkbox", { name: "FAB" }));
  fireEvent.click(screen.getByRole("button", { name: "Save account" }));
  expect(await screen.findByText(third, { selector: "output" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Edit account BEM only" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Edit account FAB only" }),
  ).toBeTruthy();
});
