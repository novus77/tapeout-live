// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import { SnapshotTime } from "./SnapshotTime";
import type { Snapshot } from "./bridge";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const snapshot = (): Snapshot => ({
  resource: "network",
  fetchedAt: Date.now() / 1000,
  observedAt: new Date().toISOString(),
  stale: false,
  data: {},
});
it("distinguishes source delay from successful synchronization", () => {
  const data = { ...snapshot(), stale: true };
  render(<SnapshotTime snapshot={data} language="zh" interval={120} />);
  expect(screen.getByText("上游数据延迟")).toBeTruthy();
  expect(screen.getByText("上游数据延迟").title).toContain("最近同步");
});
it("shows fetching and cached failure independently of source age", () => {
  const view = render(
    <SnapshotTime
      snapshot={snapshot()}
      language="zh"
      interval={120}
      job={{ busy: true, nextAt: 0, terminal: false }}
    />,
  );
  expect(screen.getByText("更新中")).toBeTruthy();
  view.rerender(
    <SnapshotTime
      snapshot={snapshot()}
      language="zh"
      interval={120}
      job={{ busy: false, error: "HTTP 429", nextAt: 1, terminal: false }}
    />,
  );
  expect(screen.getByText("更新失败，显示缓存")).toBeTruthy();
});
it("updates local overdue status without snapshot events", () => {
  vi.useFakeTimers();
  render(<SnapshotTime snapshot={snapshot()} language="zh" interval={60} />);
  expect(screen.getByText("已同步")).toBeTruthy();
  act(() => vi.advanceTimersByTime(190000));
  expect(screen.getByText("等待同步")).toBeTruthy();
});
