import { useEffect, useState } from "react";
import { command, object, rows, type Dashboard } from "./bridge";
import { locale, translator } from "./i18n";
export function historyPoints(input: unknown[], now = Date.now()) {
  return input
    .flatMap((value) => {
      const point = object(value),
        stamp = point.time ?? point.at;
      const time =
        typeof stamp === "number"
          ? stamp * 1000
          : typeof stamp === "string"
            ? Date.parse(stamp)
            : NaN;
      const raw = point.weight ?? point.value ?? point.power;
      const power =
        typeof raw === "number" ||
        (typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw))
          ? Number(raw)
          : NaN;
      return Number.isFinite(time) &&
        time <= now &&
        time >= now - 86400000 &&
        Number.isFinite(power) &&
        power >= 0
        ? [{ time, power, raw: String(raw) }]
        : [];
    })
    .sort((a, b) => a.time - b.time);
}
export function PowerHistory({
  data,
  suspended = false,
}: {
  data: Dashboard;
  suspended?: boolean;
}) {
  const { project, wallet, language } = data.settings,
    t = translator(language),
    key = `${project}:${wallet}`;
  const [local, setLocal] = useState<{
    key: string;
    points: ReturnType<typeof historyPoints>;
  }>({ key: "", points: [] });
  const [inspection, setInspection] = useState<{
    key: string;
    time: number;
  } | null>(null);
  useEffect(() => setInspection(null), [key, suspended]);
  const owned =
    data.address?.wallet?.toLowerCase() === wallet.toLowerCase() &&
    data.address?.resource === (project === "fab" ? "fab_address" : "address");
  const provider = owned
    ? historyPoints(rows(object(data.address?.data.hashrateHistory).points))
    : [];
  useEffect(() => {
    let alive = true;
    if (!suspended && wallet && provider.length === 0)
      void command<unknown[]>("get_history", {
        resource: "address",
        metric: "power",
      })
        .then((value) => {
          if (alive)
            setLocal({
              key,
              points: historyPoints(Array.isArray(value) ? value : []),
            });
        })
        .catch(() => {
          if (alive) setLocal({ key, points: [] });
        });
    return () => {
      alive = false;
    };
  }, [key, wallet, provider.length, data.address?.fetchedAt, suspended]);
  const points = suspended
    ? []
    : provider.length > 0
      ? provider
      : local.key === key
        ? historyPoints(
            local.points.map((p) => ({ time: p.time / 1000, value: p.raw })),
          )
        : [];
  const min = Math.min(...points.map((p) => p.power)),
    max = Math.max(...points.map((p) => p.power)),
    flat = min === max;
  const padding = flat ? Math.max(Math.abs(min) * 0.1, 1) : 0,
    low = min - padding,
    range = flat ? padding * 2 : max - min;
  const span = (points.at(-1)?.time ?? 0) - (points[0]?.time ?? 0) || 1;
  const latest = points.at(-1);
  const selectedIndex =
    inspection?.key === key
      ? Math.max(
          0,
          points.findIndex((p) => p.time === inspection.time),
        )
      : Math.max(0, points.length - 1);
  const inspected = points[selectedIndex];
  const stamp = (time: number) =>
    new Date(time).toLocaleString(locale(language), {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const full = (point: NonNullable<typeof latest>) =>
    `${point.raw} H · ${stamp(point.time)}`;
  const x = (time: number) => 66 + ((time - points[0].time) / span) * 308;
  const y = (power: number) => 66 - ((power - low) / range) * 60;
  const axis = (value: number) =>
    `${new Intl.NumberFormat(locale(language), { notation: Math.abs(value) >= 1000000 ? "compact" : "standard", maximumFractionDigits: 2 }).format(value)} H`;
  return (
    <section className="power-history">
      <div className="section-title">
        <h2>{t("powerHistory")}</h2>
        <span className="helper">{t("last24")}</span>
      </div>
      {latest && (
        <div
          className="history-sample"
          title={`${t("latestSample")}: ${full(latest)}`}
        >
          <span>{t("latestSample")}</span>
          <strong>{latest.raw} H</strong>
          <time dateTime={new Date(latest.time).toISOString()}>
            {stamp(latest.time)}
          </time>
        </div>
      )}
      <div className="chart">
        {points.length < 2 ? (
          <span className="chart-empty">{t("history")}</span>
        ) : (
          <svg
            viewBox="0 0 380 72"
            preserveAspectRatio="none"
            role="slider"
            tabIndex={0}
            aria-label={t("powerHistory")}
            aria-valuemin={0}
            aria-valuemax={points.length - 1}
            aria-valuenow={selectedIndex}
            aria-valuetext={full(inspected)}
            onKeyDown={(event) => {
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? points.length - 1
                    : event.key === "ArrowRight" || event.key === "ArrowUp"
                      ? Math.min(points.length - 1, selectedIndex + 1)
                      : event.key === "ArrowLeft" || event.key === "ArrowDown"
                        ? Math.max(0, selectedIndex - 1)
                        : null;
              if (next !== null) {
                event.preventDefault();
                setInspection({ key, time: points[next].time });
              }
            }}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              if (!rect.width || !Number.isFinite(event.clientX)) return;
              const position = ((event.clientX - rect.left) / rect.width) * 380;
              const nearest = points.reduce(
                (best, point, i) =>
                  Math.abs(x(point.time) - position) <
                  Math.abs(x(points[best].time) - position)
                    ? i
                    : best,
                0,
              );
              setInspection({ key, time: points[nearest].time });
            }}
          >
            {(flat ? [min] : [max, (min + max) / 2, min]).map((value, i) => (
              <g key={i}>
                <text x="0" y={y(value) + 3} className="chart-axis">
                  {axis(value)}
                </text>
                <line
                  x1="66"
                  x2="374"
                  y1={y(value)}
                  y2={y(value)}
                  className="chart-grid"
                />
              </g>
            ))}
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
              points={points.map((p) => `${x(p.time)},${y(p.power)}`).join(" ")}
            />
            <circle
              cx={x(inspected.time)}
              cy={y(inspected.power)}
              r="2.5"
              fill="currentColor"
            />
          </svg>
        )}
      </div>
      {points.length >= 2 && (
        <div
          className={`history-sample inspected ${inspection?.key === key ? "" : "inspection-placeholder"}`}
          role={inspection?.key === key ? "status" : undefined}
          aria-hidden={inspection?.key !== key}
        >
          <span>{t("inspectedSample")}</span>
          <strong>{inspected.raw} H</strong>
          <time dateTime={new Date(inspected.time).toISOString()}>
            {stamp(inspected.time)}
          </time>
        </div>
      )}
      {points.length >= 2 && (
        <div className="chart-times">
          {[points[0], points.at(-1)!].map((p, i) => (
            <time key={i}>
              {new Date(p.time).toLocaleString(locale(language), {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          ))}
        </div>
      )}
    </section>
  );
}
