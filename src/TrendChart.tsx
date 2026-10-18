import { useId, useState } from "react";
import { locale, translator, type Language } from "./i18n";
import { trendPoints, trendSegments, type TrendRange } from "./trendData";

export function TrendChart({
  input,
  title,
  unit,
  language,
  collapsible = false,
}: {
  input: unknown;
  title: string;
  unit: string;
  language: Language;
  collapsible?: boolean;
}) {
  const t = translator(language),
    id = useId();
  const [range, setRange] = useState<TrendRange>("24h"),
    [collapsed, setCollapsed] = useState(false);
  const [inspection, setInspection] = useState<{
    input: unknown;
    range: TrendRange;
    index: number;
  } | null>(null);
  const points = trendPoints(input, range),
    inspected =
      inspection && inspection.input === input && inspection.range === range
        ? points[inspection.index]
        : undefined;
  const lowValue = points.length ? Math.min(...points.map((p) => p.value)) : 0,
    highValue = points.length ? Math.max(...points.map((p) => p.value)) : 1;
  const pad = Math.max(
      (highValue - lowValue) * 0.08,
      highValue * 0.005,
      0.00000001,
    ),
    low = Math.max(0, lowValue - pad),
    high = highValue + pad;
  const first = points[0]?.time ?? 0,
    last = points.at(-1)?.time ?? 1;
  const x = (time: number) =>
    points.length === 1
      ? 210
      : 55 + ((time - first) / (last - first || 1)) * 319;
  const y = (value: number) => 40 - ((value - low) / (high - low || 1)) * 32;
  const stamp = (time: number) =>
    new Date(time).toLocaleString(locale(language), {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const axis = (value: number) =>
    new Intl.NumberFormat(locale(language), {
      notation: high > 0 && high < 0.0001 ? "scientific" : "compact",
      maximumSignificantDigits: 4,
    }).format(value);
  return (
    <section className="trend-section" aria-label={title}>
      <div className="trend-heading">
        <span>{title}</span>
        <div>
          {(["24h", "7d"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={value === range}
              onClick={() => {
                setRange(value);
                setInspection(null);
              }}
            >
              {value}
            </button>
          ))}
          {collapsible && (
            <button
              aria-expanded={!collapsed}
              aria-controls={id}
              onClick={() => {
                setCollapsed(!collapsed);
                setInspection(null);
              }}
            >
              {t(collapsed ? "expandTrend" : "collapseTrend")}
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div id={id} className="trend-plot">
          {points.length ? (
            <svg
              viewBox="0 0 386 56"
              role="img"
              tabIndex={0}
              aria-label={`${title} · ${unit}`}
              aria-describedby={inspected ? `${id}-tip` : undefined}
              onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect(),
                  pointer =
                    ((event.clientX - bounds.left) / (bounds.width || 386)) *
                    386;
                let index = 0;
                for (let i = 1; i < points.length; i++)
                  if (
                    Math.abs(x(points[i].time) - pointer) <
                    Math.abs(x(points[index].time) - pointer)
                  )
                    index = i;
                setInspection({ input, range, index });
              }}
              onPointerLeave={() => setInspection(null)}
              onBlur={() => setInspection(null)}
              onKeyDown={(event) => {
                if (
                  ![
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                    "Escape",
                  ].includes(event.key)
                )
                  return;
                event.preventDefault();
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setInspection(null);
                  return;
                }
                const index =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? points.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            points.length - 1,
                            (inspected
                              ? inspection!.index
                              : event.key === "ArrowRight"
                                ? -1
                                : points.length) +
                              (event.key === "ArrowRight" ? 1 : -1),
                          ),
                        );
                setInspection({ input, range, index });
              }}
            >
              <line x1="55" y1="8" x2="374" y2="8" />
              <line x1="55" y1="40" x2="374" y2="40" />
              <text x="0" y="12">
                {axis(high)} {unit}
              </text>
              <text x="0" y="40">
                {axis(low)} {unit}
              </text>
              {trendSegments(points, range).map((segment, index) =>
                segment.length === 1 ? (
                  <circle
                    key={index}
                    cx={x(segment[0].time)}
                    cy={y(segment[0].value)}
                    r="2"
                  />
                ) : (
                  <path
                    key={index}
                    d={segment
                      .map(
                        (p, i) => `${i ? "L" : "M"}${x(p.time)},${y(p.value)}`,
                      )
                      .join(" ")}
                  />
                ),
              )}
              <text x="55" y="54">
                {stamp(first)}
              </text>
              {points.length > 1 && (
                <text x="374" y="54" textAnchor="end">
                  {stamp(last)}
                </text>
              )}
              {inspected && (
                <>
                  <line
                    className="trend-guide"
                    x1={x(inspected.time)}
                    x2={x(inspected.time)}
                    y1="5"
                    y2="40"
                  />
                  <circle
                    cx={x(inspected.time)}
                    cy={y(inspected.value)}
                    r="3"
                  />
                </>
              )}
            </svg>
          ) : (
            <p className="trend-empty">{t("noTrend")}</p>
          )}
          {inspected && (
            <div
              id={`${id}-tip`}
              role="tooltip"
              className="trend-tooltip"
              style={{
                left: `${Math.min(45, Math.max(1, (x(inspected.time) / 386) * 100 - 22))}%`,
              }}
            >
              {stamp(inspected.time)} · {inspected.raw} {unit}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
