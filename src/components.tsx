import type { ReactNode } from "react";
import { formatMetric } from "./metrics";
export function Sparkline({
  values,
  label,
}: {
  values: number[];
  label: string;
}) {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2)
    return <div className="chart-empty">Collecting history</div>;
  const min = Math.min(...finite),
    range = Math.max(...finite) - min || 1;
  const points = finite
    .map(
      (v, i) =>
        `${(i / (finite.length - 1)) * 160},${36 - ((v - min) / range) * 30}`,
    )
    .join(" ");
  return (
    <svg
      className="sparkline"
      viewBox="0 0 160 40"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export function Metric({
  title,
  value,
  unit,
  note,
  icon,
  values,
  accent = false,
}: {
  title: string;
  value: unknown;
  unit?: string;
  note?: string;
  icon?: ReactNode;
  values?: number[];
  accent?: boolean;
}) {
  return (
    <article className={`metric ${accent ? "accent" : ""}`}>
      <div className="metric-label">
        {icon}
        {title}
      </div>
      <div className="metric-number">
        {formatMetric(value)}
        {unit && <span>{unit}</span>}
      </div>
      {values && <Sparkline values={values} label={`${title} history`} />}
      <div className="metric-note">{note ?? "\u00a0"}</div>
    </article>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
          <rect x="6" y="6" width="20" height="20" rx="4" />
          <path d="M11 16h10M16 11v10" />
        </svg>
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
