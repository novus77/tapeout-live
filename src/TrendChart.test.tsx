// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TrendChart } from "./TrendChart";
afterEach(cleanup);
const now = Date.now();
const points = [
  { time: now / 1000 - 60, value: "0" },
  { time: now / 1000, value: "123" },
];
it("inspects with pointer and keyboard without a slider or constant value row", () => {
  render(
    <TrendChart input={points} language="en" title="Network trend" unit="H" />,
  );
  expect(screen.queryByRole("slider")).toBeNull();
  expect(screen.queryByRole("tooltip")).toBeNull();
  const chart = screen.getByRole("img", { name: /Network trend/ });
  fireEvent.pointerMove(chart, { clientX: 100 });
  expect(screen.getByRole("tooltip").textContent).toContain("H");
  fireEvent.pointerLeave(chart);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.keyDown(chart, { key: "End" });
  expect(screen.getByRole("tooltip").textContent).toContain("123 H");
  fireEvent.blur(chart);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
it("shows an honest empty state and supports range and collapse", () => {
  render(
    <TrendChart
      input={[]}
      language="en"
      title="Network trend"
      unit="H"
      collapsible
    />,
  );
  expect(screen.getByText("No history available")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "7d" }));
  expect(
    screen.getByRole("button", { name: "7d" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
  expect(screen.queryByText("No history available")).toBeNull();
});
it("preserves the full observed decimal and distinguishes small nonzero axis bounds", () => {
  const { container } = render(
    <TrendChart
      input={[{ time: Date.now() / 1000 - 1, value: "0.00000000123456789" }]}
      language="en"
      title="Network power"
      unit="H"
    />,
  );
  const chart = screen.getByRole("img", { name: /Network power/ });
  fireEvent.keyDown(chart, { key: "End" });
  expect(screen.getByRole("tooltip").textContent).toContain(
    "0.00000000123456789 H",
  );
  const labels = [...container.querySelectorAll("svg text")]
    .slice(0, 2)
    .map((n) => n.textContent);
  expect(labels[0]).not.toBe(labels[1]);
  expect(labels[0]).not.toBe("0 H");
});
