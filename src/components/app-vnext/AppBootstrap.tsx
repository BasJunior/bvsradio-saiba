"use client";

import { useEffect } from "react";

export type AppSurface = "ios" | "android";

export default function AppBootstrap({ surface }: { surface: AppSurface }) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.bvsAppShell = "true";
    root.dataset.bvsAppSurface = surface;
    try {
      window.localStorage.setItem("bvs_app_surface", surface);
      window.localStorage.setItem("bvs_app_version", "vnext");
    } catch {
      // Storage is an enhancement; never block the app shell.
    }
    window.dispatchEvent(new CustomEvent("bvs:app-shell-ready", { detail: { surface, version: "vnext" } }));
    return () => {
      delete root.dataset.bvsAppShell;
      delete root.dataset.bvsAppSurface;
    };
  }, [surface]);
  return null;
}
