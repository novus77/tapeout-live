import type { Snapshot } from "./bridge";
import { locale, translator, type Language } from "./i18n";
import { freshness } from "./metrics";

export function SnapshotTime({
  snapshot,
  language,
  interval,
}: {
  snapshot: Snapshot | null;
  language: Language;
  interval: number;
}) {
  const t = translator(language),
    state =
      snapshot?.data.pending === true
        ? "pending"
        : freshness(snapshot, interval);
  const label =
    state === "pending"
      ? "indexing"
      : state === "fresh"
        ? "fresh"
        : state === "stale"
          ? "stale"
          : state === "unknown"
            ? "unknown"
            : "unavailable";
  return (
    <span
      className={`sync ${state}`}
      title={
        snapshot?.observedAt
          ? `${t("source")} ${new Date(snapshot.observedAt).toLocaleString(locale(language))}`
          : t("unknown")
      }
    >
      <i />
      {t(label)}
    </span>
  );
}
