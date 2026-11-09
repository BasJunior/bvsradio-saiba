import { NextResponse } from "next/server";
import { audit, can, editorialIdentity, editorialUrl, serviceHeaders } from "@/lib/editorial-server";
import { STREAM_PAY_RULES_VERSION, calculateStreamPay, cleanStreamPaySettings, monthBounds, type StreamDeclaration, type StreamListen, type StreamTrack } from "@/lib/stream-pay";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
const PAGE = 1000;

async function allRows<T = Row>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < 100000; offset += PAGE) {
    const response = await fetch(editorialUrl(`${path}&limit=${PAGE}&offset=${offset}`), { headers: serviceHeaders, cache: "no-store" });
    if (!response.ok) throw new Error(`stream pay source ${response.status}`);
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function optional<T = Row>(path: string) {
  try {
    return { rows: await allRows<T>(path), available: true };
  } catch {
    return { rows: [] as T[], available: false };
  }
}

const money = (value: unknown) => { const amount = Number(value); return Number.isFinite(amount) ? amount : 0; };
const currentMonth = () => new Date().toISOString().slice(0, 7);

async function settings() {
  const rows = await optional<{ value?: unknown }>("artist_wallet_settings?key=eq.stream_pay_program&select=value");
  return { settings: cleanStreamPaySettings(rows.rows[0]?.value), configured: rows.available && rows.rows.length > 0 };
}

async function calculate(month: string) {
  const bounds = monthBounds(month)!;
  const current = await settings();
  const [listens, tracks, staff, declarations, funding] = await Promise.all([
    allRows<StreamListen>(`stream_qualifications?status=eq.pending&qualified_at=gte.${bounds.startIso}&qualified_at=lt.${bounds.endIso}&select=track_id,user_id,listener_key,qualified_at&order=qualified_at.asc`).catch(() => allRows<StreamListen>(`stream_qualifications?status=eq.pending&qualified_at=gte.${bounds.startIso}&qualified_at=lt.${bounds.endIso}&select=track_id,user_id,qualified_at&order=qualified_at.asc`)),
    allRows<StreamTrack>("tracks?select=id,user_id,release_id,artist_name&order=id.asc"),
    allRows<{ user_id: string }>("editorial_staff?select=user_id&order=user_id.asc"),
    optional<StreamDeclaration>("music_rights_declarations?select=release_id,track_id,society_status,grant_accepted_at,spot_check_result,clearance_basis&order=id.asc"),
    optional<{ source: string; amount_usd: unknown; note?: string; id: string }>(`stream_pot_funding?month=eq.${bounds.start}&select=id,source,amount_usd,note&order=created_at.asc`),
  ]);
  const added = funding.rows.reduce((sum, row) => sum + money(row.amount_usd), 0);
  const potUsd = Math.round((current.settings.monthlyPotUsd + added) * 100) / 100;
  const result = calculateStreamPay({ listens, tracks, staffIds: new Set(staff.map((row) => row.user_id)), declarations: declarations.rows, settings: current.settings, potUsd });
  return { ...result, potUsd, funding: funding.rows, settings: current.settings, configured: current.configured && funding.available, totalListens: listens.length };
}

async function access(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return { error: NextResponse.json({ error: "Active Editorial staff access is required." }, { status: 403 }) };
  return { identity };
}

export async function GET(request: Request) {
  const allowed = await access(request);
  if (allowed.error) return allowed.error;
  const month = new URL(request.url).searchParams.get("month") || currentMonth();
  const bounds = monthBounds(month);
  if (!bounds) return NextResponse.json({ error: "Choose a valid month." }, { status: 400 });
  try {
    const [preview, runs] = await Promise.all([calculate(month), optional<Row>("stream_pay_runs?select=*&order=month.desc")]);
    const run = runs.rows.find((row) => String(row.month) === bounds.start && row.status !== "voided") || null;
    const lines = run ? await optional<Row>(`stream_pay_run_lines?run_id=eq.${run.id}&select=*&order=total_usd.desc`) : { rows: [] as Row[], available: true };
    return NextResponse.json({
      serverTime: new Date().toISOString(),
      month,
      currentMonth: currentMonth(),
      monthEnded: month < currentMonth(),
      canManage: can(allowed.identity, "manage_artist_wallet"),
      preview,
      run,
      runLines: lines.rows,
      history: runs.rows.filter((row) => row.status !== "voided").slice(0, 12),
      paidToDate: runs.rows.filter((row) => row.status === "credited").reduce((sum, row) => sum + money(row.total_paid_usd), 0),
    });
  } catch (error) {
    console.error("Stream pay failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Stream pay could not load. Nothing has been changed." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const allowed = await access(request);
  if (allowed.error) return allowed.error;
  if (!can(allowed.identity, "manage_artist_wallet")) return NextResponse.json({ error: "Wallet permission is required." }, { status: 403 });
  const actor = allowed.identity.user.id;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");
  const write = (path: string, method: string, payload: unknown, prefer = "return=representation") => fetch(editorialUrl(path), { method, headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: prefer }, body: JSON.stringify(payload) });

  try {
    if (action === "save_settings") {
      const incoming = { baseRateUsd: Number(body.baseRateUsd), monthlyPotUsd: Number(body.monthlyPotUsd), maxArtistPotShare: Number(body.maxArtistPotShare), reviewDays: Number(body.reviewDays) };
      const clean = cleanStreamPaySettings(incoming);
      if (Object.keys(incoming).some((key) => clean[key as keyof typeof clean] !== (key === "reviewDays" ? Math.round(incoming.reviewDays) : incoming[key as keyof typeof incoming]))) return NextResponse.json({ error: "Check the rate, pot, cap and review days." }, { status: 400 });
      const response = await write("artist_wallet_settings?key=eq.stream_pay_program", "PATCH", { value: clean });
      if (!response.ok || !((await response.json()) as Row[]).length) throw new Error("settings not saved");
      await audit(actor, "stream_pay_settings", "wallet_setting", "stream_pay_program", clean);
      return NextResponse.json({ ok: true });
    }

    const month = String(body.month || "");
    const bounds = monthBounds(month);

    if (action === "add_funding") {
      const amount = Number(body.amountUsd);
      const source = String(body.source || "");
      if (!bounds || !(amount > 0) || amount > 100000 || !["bvs", "sponsor", "advertising"].includes(source)) return NextResponse.json({ error: "Choose a month, source and amount." }, { status: 400 });
      const response = await write("stream_pot_funding", "POST", { month: bounds.start, source, amount_usd: Math.round(amount * 100) / 100, note: String(body.note || "").trim().slice(0, 200) || null, created_by: actor });
      if (!response.ok) throw new Error("funding not saved");
      await audit(actor, "stream_pot_funding", "stream_pot", bounds.start, { source, amount });
      return NextResponse.json({ ok: true });
    }

    if (action === "create_run") {
      if (!bounds) return NextResponse.json({ error: "Choose a month." }, { status: 400 });
      if (month >= currentMonth()) return NextResponse.json({ error: "A month can only be run after it ends." }, { status: 409 });
      const result = await calculate(month);
      if (!result.configured) return NextResponse.json({ error: "Stream pay isn’t set up yet." }, { status: 503 });
      const reviewUntil = new Date(Date.now() + result.settings.reviewDays * 86400000).toISOString();
      const created = await write("stream_pay_runs", "POST", { month: bounds.start, status: "in_review", rules_version: STREAM_PAY_RULES_VERSION, base_rate_usd: result.settings.baseRateUsd, max_artist_pot_share: result.settings.maxArtistPotShare, pot_funded_usd: result.potUsd, pot_paid_usd: result.potPaidUsd, pot_rollover_usd: result.potRolloverUsd, total_paid_usd: result.totalPaidUsd, counted_listens: result.countedListens, excluded: result.excluded, artist_count: result.lines.length, review_until: reviewUntil, created_by: actor });
      if (created.status === 409) return NextResponse.json({ error: "This month already has a run." }, { status: 409 });
      if (!created.ok) throw new Error("run not saved");
      const [run] = (await created.json()) as Array<{ id: string }>;
      if (result.lines.length) {
        const saved = await write("stream_pay_run_lines", "POST", result.lines.map((line) => ({ run_id: run.id, artist_user_id: line.artistUserId, artist_name: line.artistName, listens: line.listens, listeners: line.listeners, pot_listens: line.potListens, pot_status: line.potStatus, base_usd: line.baseUsd, pot_usd: line.potUsd, total_usd: line.totalUsd })), "return=minimal");
        if (!saved.ok) { await fetch(editorialUrl(`stream_pay_runs?id=eq.${run.id}`), { method: "DELETE", headers: serviceHeaders }); throw new Error("lines not saved"); }
      }
      await audit(actor, "stream_pay_run_created", "stream_pay_run", run.id, { month, total: result.totalPaidUsd });
      return NextResponse.json({ ok: true, reviewUntil });
    }

    const runId = String(body.runId || "");
    if (!/^[0-9a-f-]{36}$/i.test(runId)) return NextResponse.json({ error: "Choose a run." }, { status: 400 });

    if (action === "void_run") {
      const response = await write(`stream_pay_runs?id=eq.${runId}&status=eq.in_review`, "PATCH", { status: "voided" });
      if (!response.ok || !((await response.json()) as Row[]).length) return NextResponse.json({ error: "Only a run in review can be cancelled." }, { status: 409 });
      await audit(actor, "stream_pay_run_voided", "stream_pay_run", runId);
      return NextResponse.json({ ok: true });
    }

    if (action === "credit_run") {
      const response = await write("rpc/credit_stream_pay_run", "POST", { p_run_id: runId, p_actor: actor });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; credited?: number; total?: number };
      if (!response.ok) {
        if (String(payload.message).includes("review_window_open")) return NextResponse.json({ error: "The review period hasn’t ended yet." }, { status: 409 });
        if (String(payload.message).includes("run_not_in_review")) return NextResponse.json({ error: "This run has already been handled." }, { status: 409 });
        throw new Error("credit failed");
      }
      await audit(actor, "stream_pay_run_credited", "stream_pay_run", runId, { credited: payload.credited, total: payload.total });
      return NextResponse.json({ ok: true, ...payload });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Stream pay action failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "That couldn’t be saved. Nothing was paid." }, { status: 503 });
  }
}
