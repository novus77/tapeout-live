import { describe, expect, it } from "vitest";
import { circuitTotals, formatMetric, freshness } from "./metrics";
describe("monitor semantics", () => {
  it("preserves decimal-string precision without floating point rounding", () => {
    expect(formatMetric("9007199254740993", 0)).toBe("9,007,199,254,740,993");
    expect(formatMetric("123456789012345678.12345678", 8)).toBe(
      "123,456,789,012,345,678.12345678",
    );
    expect(formatMetric("0.00000001", 8)).toBe("0.00000001");
    expect(formatMetric("0.00000001", 2)).toBe("<0.01");
  });
  it("distinguishes unavailable from zero", () => {
    expect(formatMetric(null)).toBe("—");
    expect(formatMetric(0)).toBe("0");
    expect(formatMetric(Number.NaN)).toBe("—");
  });
  it("does not count grouped power as a complete collection", () => {
    expect(
      circuitTotals(
        [{ count: 3, is_champion: 1, current_hashrate: 10, pool: "verified" }],
        3,
      ).verified,
    ).toBeNull();
    expect(
      circuitTotals(
        [{ count: 1, is_champion: 1, current_hashrate: 10, pool: "verified" }],
        1,
      ),
    ).toEqual({ optimal: 1, verified: 10, unverified: 0 });
  });
  it("does not treat freshly fetched old observations as fresh", () => {
    const now = Date.parse("2026-10-16T12:00:00Z");
    expect(
      freshness(
        {
          fetchedAt: now / 1000,
          observedAt: "2026-10-16T11:00:00Z",
          stale: false,
        },
        60,
        now,
      ),
    ).toBe("stale");
    expect(freshness({ fetchedAt: now / 1000, stale: false }, 60, now)).toBe(
      "unknown",
    );
  });
});
