// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { defaults } from "./bridge";
import { resolveTheme, useAppearance, type Appearance } from "./appearance";
const mock = vi.hoisted(() => ({
  listener: null as null | ((e: { payload: Appearance }) => void),
  unlisten: vi.fn(),
  command: vi.fn(),
  registration: null as null | Promise<void>,
}));
vi.mock("./bridge", async (original) => ({
  ...(await original<typeof import("./bridge")>()),
  native: true,
  command: mock.command,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: async (_name: string, callback: typeof mock.listener) => {
    await mock.registration;
    mock.listener = callback;
    return mock.unlisten;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mock.registration = null;
});
it("registers the native listener before querying the initial appearance", async () => {
  let register: (() => void) | undefined;
  mock.registration = new Promise((resolve) => {
    register = resolve;
  });
  mock.command.mockResolvedValue({ systemDark: true, material: true });
  renderHook(() => useAppearance({ ...defaults, followSystemTheme: true }));
  expect(mock.command).not.toHaveBeenCalledWith("get_appearance");
  await act(async () => {
    register?.();
  });
  await waitFor(() =>
    expect(mock.command).toHaveBeenCalledWith("get_appearance"),
  );
});
it("queries appearance after failed listener registration and cleans late registration", async () => {
  mock.registration = Promise.reject(new Error("Listener unavailable"));
  mock.command.mockImplementation(async (name) =>
    name === "get_appearance"
      ? { systemDark: false, material: false }
      : undefined,
  );
  const first = renderHook(() => useAppearance(defaults));
  await waitFor(() =>
    expect(mock.command).toHaveBeenCalledWith("get_appearance"),
  );
  first.unmount();
  mock.command.mockClear();
  let register: (() => void) | undefined;
  mock.registration = new Promise((resolve) => {
    register = resolve;
  });
  const second = renderHook(() => useAppearance(defaults));
  second.unmount();
  await act(async () => {
    register?.();
  });
  expect(mock.unlisten).toHaveBeenCalledOnce();
  expect(mock.command).not.toHaveBeenCalledWith("get_appearance");
});
it("retains the manual theme while following and restores it afterwards", () => {
  expect(resolveTheme({ theme: "dark", followSystemTheme: false }, false)).toBe(
    "dark",
  );
  expect(resolveTheme({ theme: "dark", followSystemTheme: true }, false)).toBe(
    "light",
  );
  expect(resolveTheme({ theme: "light", followSystemTheme: true }, true)).toBe(
    "dark",
  );
});
it("uses native system events, preserves manual choice and cleans up the listener", async () => {
  mock.command.mockImplementation(async (name) =>
    name === "get_appearance"
      ? { systemDark: true, material: true }
      : undefined,
  );
  const { rerender, unmount } = renderHook(
    (settings) => useAppearance(settings),
    {
      initialProps: {
        ...defaults,
        theme: "dark" as const,
        followSystemTheme: true,
      },
    },
  );
  await waitFor(() =>
    expect(document.documentElement.dataset.theme).toBe("dark"),
  );
  act(() =>
    mock.listener?.({ payload: { systemDark: false, material: false } }),
  );
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.dataset.material).toBe("opaque");
  rerender({ ...defaults, theme: "dark", followSystemTheme: false });
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(
    mock.command.mock.calls.filter(([name]) => name === "present_panel"),
  ).toHaveLength(1);
  unmount();
  expect(mock.unlisten).toHaveBeenCalledOnce();
});
it("reveals an opaque manual-theme panel when native appearance lookup fails", async () => {
  mock.command.mockImplementation(async (name) => {
    if (name === "get_appearance") throw new Error("Unavailable");
  });
  renderHook(() => useAppearance({ ...defaults, theme: "dark" }));
  await waitFor(() =>
    expect(mock.command).toHaveBeenCalledWith("present_panel"),
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.material).toBe("opaque");
});
