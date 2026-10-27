import { analyticsAllowed } from "@/lib/analytics";

export type SignupFunnelStep =
  | "join_prompt_shown"
  | "join_prompt_dismissed"
  | "join_cta_clicked"
  | "signup_page_viewed"
  | "validation_failed"
  | "submit_attempted"
  | "submit_failed"
  | "account_created"
  | "confirmation_email_shown"
  | "confirmation_resent"
  | "confirmation_started"
  | "confirmation_failed"
  | "account_confirmed"
  | "premium_options_shown"
  | "premium_option_clicked";

export type SignupFunnelProperties = Record<string, string | number | boolean | null | undefined>;

const FUNNEL_ID_KEY = "bvs.signup.funnel.session.v1";

function signupSurface(path: string) {
  const match = path.match(/^\/app\/(ios|android)(?:\/|$)/);
  return match?.[1] || "web";
}

function requestedSurface(properties: SignupFunnelProperties, path: string) {
  const override = properties.app_surface || properties.surface;
  return override === "ios" || override === "android" || override === "web"
    ? override
    : signupSurface(path);
}

function funnelId() {
  if (typeof window === "undefined") return "";
  try {
    let value = window.sessionStorage.getItem(FUNNEL_ID_KEY);
    if (!value) {
      value = crypto.randomUUID();
      window.sessionStorage.setItem(FUNNEL_ID_KEY, value);
    }
    return value;
  } catch {
    return "";
  }
}

export function trackSignupFunnel(step: SignupFunnelStep, properties: SignupFunnelProperties = {}) {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !analyticsAllowed()) return;

  const cleanProperties = Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => value !== undefined)
      .slice(0, 10),
  );
  const path = window.location.pathname;
  const body = JSON.stringify({
    step,
    surface: requestedSurface(properties, path),
    path,
    funnelId: funnelId(),
    properties: cleanProperties,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/signup-funnel", new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch("/api/analytics/signup-funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}
