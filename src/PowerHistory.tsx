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
        ? [{ time, power }]
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
  const owned =
    data.address?.wallet?.toLowerCase() === wallet.toLowerCase() &&
    data.address?.resource === (project === "fab" ? "fab_address" : "address");
  const provider = owned
    ? historyPoints(rows(object(data.address?.data.hashrateHistory).points))
    : [];
  useEffect(() => {
    let alive = true;
    if (!suspended && wallet && provider.length < 2)
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
    : provider.length >= 2
      ? provider
      : local.key === key
        ? historyPoints(
            local.points.map((p) => ({ time: p.time / 1000, value: p.power })),
          )
        : [];
  const min = Math.min(...points.map((p) => p.power)),
    range = Math.max(...points.map((p) => p.power)) - min || 1;
  const span = (points.at(-1)?.time ?? 0) - (points[0]?.time ?? 0) || 1;
  return (
    <section className="power-history">
      <div className="section-title">
        <h2>{t("powerHistory")}</h2>
        <span className="helper">{t("last24")}</span>
      </div>
      <div className="chart">
        {points.length < 2 ? (
          <span className="chart-empty">{t("history")}</span>
        ) : (
          <svg
            viewBox="0 0 380 72"
            preserveAspectRatio="none"
            role="img"
            aria-label={t("powerHistory")}
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
              points={points
                .map(
                  (p) =>
                    `${((p.time - points[0].time) / span) * 380},${66 - ((p.power - min) / range) * 60}`,
                )
                .join(" ")}
            />
          </svg>
        )}
      </div>
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
