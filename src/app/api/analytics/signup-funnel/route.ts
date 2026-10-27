import { NextResponse } from "next/server";

const allowedSteps = new Set([
  "join_prompt_shown",
  "join_prompt_dismissed",
  "join_cta_clicked",
  "signup_page_viewed",
  "validation_failed",
  "submit_attempted",
  "submit_failed",
  "account_created",
  "confirmation_email_shown",
  "confirmation_resent",
  "confirmation_started",
  "confirmation_failed",
  "account_confirmed",
  "premium_options_shown",
  "premium_option_clicked",
]);

const allowedSurfaces = new Set(["web", "ios", "android"]);

function cleanProperties(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 10)
      .flatMap(([key, item]) => {
        if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key)) return [];
        if (typeof item === "string") return [[key, item.slice(0, 120)]];
        if (typeof item === "number" && Number.isFinite(item)) return [[key, item]];
        if (typeof item === "boolean" || item === null) return [[key, item]];
        return [];
      }),
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      step?: string;
      surface?: string;
      path?: string;
      funnelId?: string;
      properties?: unknown;
    };

    const step = String(body.step || "").trim();
    const surface = String(body.surface || "").trim();
    if (!allowedSteps.has(step) || !allowedSurfaces.has(surface)) {
      return NextResponse.json({ error: "Invalid signup funnel event" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return new NextResponse(null, { status: 204 });

    const properties = cleanProperties(body.properties);
    const role = typeof properties.role === "string" ? properties.role.slice(0, 40) : null;
    const response = await fetch(`${url}/rest/v1/signup_funnel_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_step: step,
        surface,
        path: typeof body.path === "string" ? body.path.slice(0, 180) : null,
        funnel_id:
          typeof body.funnelId === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(body.funnelId)
            ? body.funnelId
            : null,
        role,
        context: properties,
      }),
    });

    return new NextResponse(null, { status: response.ok ? 204 : 503 });
  } catch {
    return NextResponse.json({ error: "Invalid signup funnel payload" }, { status: 400 });
  }
}
