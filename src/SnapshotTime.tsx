import { useEffect, useState } from "react";
import type { Job, Snapshot } from "./bridge";
import { locale, translator, type Language } from "./i18n";
import { freshness } from "./metrics";

export function snapshotDetail(
  snapshot: Snapshot | null,
  language: Language,
  interval: number,
) {
  const t = translator(language);
  const state = freshness(snapshot, interval);
  return `${t("source")} · ${snapshot?.observedAt ?? t("unknown")} · ${t(state === "fresh" ? "fresh" : state === "stale" ? "stale" : state === "unknown" ? "unknown" : "unavailable")}`;
}

export function SnapshotTime({
  snapshot,
  language,
  interval,
  job,
}: {
  snapshot: Snapshot | null;
  language: Language;
  interval: number;
  job?: Job;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      clearInterval(timer);
      if (document.visibilityState !== "hidden") {
        setNow(Date.now());
        timer = setInterval(() => setNow(Date.now()), 10000);
      }
    };
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const t = translator(language);
  const overdue = snapshot && now - snapshot.fetchedAt * 1000 > interval * 3000;
  const state = job?.busy
    ? "syncing"
    : job?.error
      ? "failed"
      : !snapshot
        ? "unavailable"
        : snapshot.data.pending === true
          ? "pending"
          : overdue
            ? "overdue"
            : freshness(snapshot, interval, now) === "stale"
              ? "stale"
              : freshness(snapshot, interval, now);
  const label =
    state === "pending"
      ? "indexing"
      : state === "fresh"
        ? "synchronized"
        : state === "stale"
          ? "upstreamDelayed"
          : state === "syncing"
            ? "updating"
            : state === "failed"
              ? snapshot
                ? "cachedFailure"
                : "refreshFailed"
              : state === "overdue"
                ? "awaitingSync"
                : state === "unknown"
                  ? "unknown"
                  : "unavailable";
  return (
    <span
      className={`sync ${state}`}
      title={[
        `${t("lastSync")} · ${snapshot ? new Date(snapshot.fetchedAt * 1000).toLocaleString(locale(language)) : t("unknown")}`,
        `${t("source")} · ${snapshot?.observedAt ? new Date(snapshot.observedAt).toLocaleString(locale(language)) : t("unknown")}`,
        job?.error,
      ]
        .filter(Boolean)
        .join("\n")}
    >
      <i />
      {t(label)}
    </span>
  );
}
