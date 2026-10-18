import { expect, it } from "vitest";
import { trendPoints, trendSegments } from "./trendData";
const now = Date.parse("2026-10-18T12:00:00Z");
it("filters real timestamp windows without dropping zero or filling gaps", () => {
  const rows = [
    { time: now / 1000 - 100, value: "0" },
    { time: now / 1000 - 100000, value: "12" },
    { time: now / 1000 + 1, value: "1" },
    { time: now / 1000 - 50, value: null },
    { time: now / 1000 - 30, value: "-1" },
  ];
  expect(trendPoints(rows, "24h", now)).toEqual([
    { time: now - 100000, value: 0, raw: "0" },
  ]);
  expect(trendPoints(rows, "7d", now)).toHaveLength(2);
});
it("breaks long gaps and keeps single observations separate", () => {
  const points = [0, 60000, 24 * 3600000].map((time) => ({
    time,
    value: 1,
    raw: "1",
  }));
  expect(trendSegments(points, "24h").map((s) => s.length)).toEqual([2, 1]);
});
