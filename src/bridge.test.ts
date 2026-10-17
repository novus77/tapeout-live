// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
it("keeps browser preview settings only in memory with empty real-data surfaces", async () => {
  vi.resetModules();
  const { command, defaults } = await import("./bridge");
  const first = "0x0000000000000000000000000000000000000000",
    second = "0x0000000000000000000000000000000000000001";
  const settings = {
    ...defaults,
    theme: "dark" as const,
    language: "en" as const,
    wallet: first,
    accounts: [
      { address: first, name: "Preview" },
      { address: second, name: "Second" },
    ],
  };
  await expect(command("update_settings", { settings })).resolves.toEqual(
    settings,
  );
  await command("select_account", { address: second });
  await command("select_project", { project: "fab" });
  const data = await command<import("./bridge").Dashboard>("get_dashboard");
  expect(data.settings).toMatchObject({
    theme: "dark",
    language: "en",
    wallet: second,
    alias: "Second",
    project: "fab",
  });
  expect([data.address, data.market, data.network]).toEqual([null, null, null]);
  expect(await command("get_history")).toEqual([]);
  const batch = await command<import("./bridge").RefreshBatch>("refresh_all");
  expect(batch.busy).toBe(false);
  expect(batch.entries).toHaveLength(6);
  expect(batch.entries.every((entry) => entry.status === "deferred")).toBe(
    true,
  );
  expect(
    (await command<import("./bridge").Dashboard>("get_dashboard")).refreshBatch,
  ).toEqual(batch);
  await expect(
    command("refresh_resource", { resource: "network" }),
  ).resolves.toBeUndefined();
  data.settings.accounts.length = 0;
  expect(
    (await command<import("./bridge").Dashboard>("get_dashboard")).settings
      .accounts,
  ).toHaveLength(2);
  vi.resetModules();
  const reset = await import("./bridge");
  expect(
    (await reset.command<import("./bridge").Dashboard>("get_dashboard"))
      .settings,
  ).toEqual(reset.defaults);
  expect(
    (
      await reset.command<import("./bridge").RefreshBatch>("refresh_all")
    ).entries.map((entry) => entry.resource),
  ).toEqual(["market", "network", "fab_market", "fab_network"]);
});
