"use client";

import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";

export type NativePlatform = "ios" | "android";
export type AppNetworkStatus = { connected: boolean; connectionType: string };
export type PushPermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied" | "unavailable";
export type AppPushAction = { notification?: { data?: Record<string, unknown> } };

type ListenerHandle = { remove: () => Promise<void> };
type PreferencesPlugin = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
};
type NetworkPlugin = {
  getStatus(): Promise<AppNetworkStatus>;
  addListener(eventName: "networkStatusChange", listener: (status: AppNetworkStatus) => void): Promise<ListenerHandle>;
};
type SharePlugin = {
  share(options: { title?: string; text?: string; url?: string; dialogTitle?: string }): Promise<{ activityType?: string }>;
};
type PushPlugin = {
  checkPermissions(): Promise<{ receive: Exclude<PushPermissionState, "unavailable"> }>;
  requestPermissions(): Promise<{ receive: Exclude<PushPermissionState, "unavailable"> }>;
  register(): Promise<void>;
  addListener(eventName: "registration", listener: (token: { value: string }) => void): Promise<ListenerHandle>;
  addListener(eventName: "registrationError", listener: (error: { error?: string }) => void): Promise<ListenerHandle>;
  addListener(eventName: "pushNotificationActionPerformed", listener: (action: AppPushAction) => void): Promise<ListenerHandle>;
};

const Preferences = registerPlugin<PreferencesPlugin>("Preferences");
const Network = registerPlugin<NetworkPlugin>("Network");
const Share = registerPlugin<SharePlugin>("Share");
const PushNotifications = registerPlugin<PushPlugin>("PushNotifications");

export function isNativeRuntime() {
  return Capacitor.isNativePlatform();
}

export async function getNativeAppInfo(): Promise<{ version: string; build: string } | null> {
  if (!isNativeRuntime()) return null;
  try {
    const info = await App.getInfo();
    return { version: info.version, build: info.build };
  } catch {
    return null;
  }
}

export function isAppStoreVnextVersion(version: string | null | undefined) {
  if (!version) return false;
  const [major, minor] = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  return major > 1 || (major === 1 && minor >= 1);
}

export async function getAppPreference(key: string): Promise<string | null> {
  if (isNativeRuntime()) {
    try {
      return (await Preferences.get({ key })).value;
    } catch {
      // The native plugin is optional in browser/preview shells.
    }
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setAppPreference(key: string, value: string): Promise<void> {
  if (isNativeRuntime()) {
    try {
      await Preferences.set({ key, value });
      return;
    } catch {
      // Fall through to web storage in preview builds.
    }
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

export async function getNetworkStatus(): Promise<AppNetworkStatus> {
  if (isNativeRuntime()) {
    try {
      return await Network.getStatus();
    } catch {}
  }
  return {
    connected: typeof navigator === "undefined" ? true : navigator.onLine,
    connectionType: "unknown",
  };
}

export async function listenNetworkStatus(listener: (status: AppNetworkStatus) => void): Promise<() => Promise<void>> {
  if (isNativeRuntime()) {
    try {
      const handle = await Network.addListener("networkStatusChange", listener);
      return () => handle.remove();
    } catch {}
  }
  const online = () => listener({ connected: true, connectionType: "unknown" });
  const offline = () => listener({ connected: false, connectionType: "none" });
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  return async () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}

export async function shareBvs(options: { title: string; text?: string; url: string }) {
  if (isNativeRuntime()) {
    try {
      await Share.share({ ...options, dialogTitle: "Share from BVS" });
      return true;
    } catch {}
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(options);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await navigator.clipboard.writeText(options.url);
    return true;
  } catch {
    return false;
  }
}

export async function listenPushNotificationActions(listener: (action: AppPushAction) => void): Promise<() => Promise<void>> {
  if (!isNativeRuntime()) return async () => undefined;
  try {
    const handle = await PushNotifications.addListener("pushNotificationActionPerformed", listener);
    return () => handle.remove();
  } catch {
    return async () => undefined;
  }
}

export async function getPushPermission(): Promise<PushPermissionState> {
  if (!isNativeRuntime()) return "unavailable";
  try {
    return (await PushNotifications.checkPermissions()).receive;
  } catch {
    return "unavailable";
  }
}

export async function registerPushDevice(accessToken: string, platform: NativePlatform): Promise<{ ok: boolean; permission: PushPermissionState; error?: string }> {
  if (!isNativeRuntime()) return { ok: false, permission: "unavailable", error: "Native push is available in the installed app build." };
  try {
    let permission = (await PushNotifications.checkPermissions()).receive;
    if (permission === "prompt" || permission === "prompt-with-rationale") {
      permission = (await PushNotifications.requestPermissions()).receive;
    }
    if (permission !== "granted") return { ok: false, permission };

    let resolveToken: ((value: string) => void) | null = null;
    let rejectToken: ((reason?: unknown) => void) | null = null;
    const tokenPromise = new Promise<string>((resolve, reject) => {
      resolveToken = resolve;
      rejectToken = reject;
    });
    const registrationHandle = await PushNotifications.addListener("registration", (token) => resolveToken?.(token.value));
    const errorHandle = await PushNotifications.addListener("registrationError", (issue) => rejectToken?.(new Error(issue.error || "Push registration failed.")));

    let deviceToken = "";
    try {
      await PushNotifications.register();
      deviceToken = await Promise.race([
        tokenPromise,
        new Promise<string>((_, reject) => window.setTimeout(() => reject(new Error("Push registration timed out.")), 12000)),
      ]);
    } finally {
      await registrationHandle.remove().catch(() => undefined);
      await errorHandle.remove().catch(() => undefined);
    }

    const response = await fetch("/api/app/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ deviceToken, platform, appVariant: "production" }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || "BVS could not save this device for notifications.");
    }
    return { ok: true, permission: "granted" };
  } catch (error) {
    return { ok: false, permission: "unavailable", error: error instanceof Error ? error.message : "Push registration failed." };
  }
}
