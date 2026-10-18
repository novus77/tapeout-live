import { expect, it, vi } from "vitest";
import { reloadQueue } from "./reloadQueue";

it("does not lose an event at the final read microtask boundary", async () => {
  let release!: () => void;
  const read = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const reload = reloadQueue(read);
  const first = reload();
  release();
  queueMicrotask(() => void reload());
  await first;
  expect(read).toHaveBeenCalledTimes(2);
});

it("can retry after a synchronously thrown read error", async () => {
  const read = vi
    .fn()
    .mockImplementationOnce(() => {
      throw new Error("read failed");
    })
    .mockResolvedValue(undefined);
  const reload = reloadQueue(read);
  await expect(reload()).rejects.toThrow("read failed");
  await reload();
  expect(read).toHaveBeenCalledTimes(2);
});

it("coalesces bursts without losing the trailing update", async () => {
  let release!: () => void;
  const read = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const reload = reloadQueue(read);
  const first = reload();
  void reload();
  void reload();
  void reload();
  expect(read).toHaveBeenCalledTimes(1);
  release();
  await first;
  expect(read).toHaveBeenCalledTimes(2);
  await reload();
  expect(read).toHaveBeenCalledTimes(3);
});
