import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { command, native, type Settings } from "./bridge";
export type Appearance = { systemDark: boolean; material: boolean };
export function resolveTheme(
  settings: Pick<Settings, "theme" | "followSystemTheme">,
  systemDark: boolean,
) {
  return settings.followSystemTheme
    ? systemDark
      ? "dark"
      : "light"
    : settings.theme;
}
export function useAppearance(settings: Settings, dashboardReady = true) {
  const [appearance, setAppearance] = useState<Appearance>({
    systemDark: false,
    material: !native,
  });
  const [ready, setReady] = useState(!native);
  const presented = useRef(false);
  useEffect(() => {
    let alive = true;
    let unlisten: (() => void) | undefined;
    const apply = (value: Appearance) => {
      if (alive && value) {
        setAppearance(value);
        setReady(true);
      }
    };
    if (native) {
      let eventReceived = false;
      const registration = listen<Appearance>("appearance_updated", (event) => {
        eventReceived = true;
        apply(event.payload);
      })
        .then((fn) => {
          if (alive) unlisten = fn;
          else fn();
        })
        .catch(() => {});
      void registration
        .then(() => (alive ? command<Appearance>("get_appearance") : undefined))
        .then((value) => {
          if (!eventReceived && value) apply(value);
          if (alive) setReady(true);
        })
        .catch(() => {
          if (alive) setReady(true);
        });
    } else {
      const media = window.matchMedia?.("(prefers-color-scheme: dark)");
      const update = () =>
        apply({ systemDark: media?.matches ?? false, material: true });
      update();
      media?.addEventListener("change", update);
      unlisten = () => media?.removeEventListener("change", update);
    }
    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);
  const theme = resolveTheme(settings, appearance.systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.material = appearance.material
      ? "glass"
      : "opaque";
    if (native && ready && dashboardReady && !presented.current) {
      presented.current = true;
      void command("present_panel").catch(() => {});
    }
  }, [theme, appearance.material, ready, dashboardReady]);
  return theme;
}
