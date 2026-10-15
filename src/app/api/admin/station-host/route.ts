import { NextResponse } from "next/server";
import { can, editorialIdentity } from "@/lib/editorial-server";
import { UUID } from "@/lib/creator-promotion-server";
import { generateHostLine } from "@/lib/station-host-generate";
import {
  PROGRAMME_ID,
  artistKey,
  durationAcceptable,
  factFingerprint,
  factSheet,
  pronunciationFor,
  stationAudioKey,
  validateScript,
} from "@/lib/station-host.mjs";
import { stationRpc, writeStationAudio } from "@/lib/station-host-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });

async function identityFor(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return null;
  return can(identity, "schedule_programmes") || can(identity, "manage_rotation") ? identity : null;
}

function conflict(result: { ok: boolean; conflict: boolean }) {
  return json({ error: result.conflict ? "Another editor changed this. Refresh, review their changes, then save again." : "The station desk could not save that change." }, result.conflict ? 409 : 503);
}

type DeskPayload = {
  settings?: Record<string, unknown>;
  pronunciations?: Array<Record<string, unknown>>;
  segments?: unknown[];
  items?: unknown[];
  undelivered?: number;
  onAir?: boolean;
};

function presentDesk(data: DeskPayload | null) {
  const settings = data?.settings || {};
  return {
    settings: {
      enabled: Boolean(settings.enabled),
      voiceId: settings.voice_id || "ara",
      minGap: settings.min_gap,
      maxGap: settings.max_gap,
      hostStopped: Boolean(settings.host_stopped_at),
      revision: Number(settings.revision) || 0,
    },
    pronunciations: (data?.pronunciations || []).map((row) => ({
      artistKey: row.artist_key,
      artistName: row.artist_name,
      spokenForm: row.spoken_form,
      status: row.status,
      asWritten: row.as_written,
      revision: row.revision,
    })),
    segments: data?.segments || [],
    items: data?.items || [],
    undelivered: Number(data?.undelivered) || 0,
    onAir: Boolean(data?.onAir),
    playoutConfigured: Boolean(process.env.BVS_PLAYOUT_STATION_ID && (process.env.BVS_PLAYOUT_SIGNING_SECRET || "").length >= 32),
    speechConfigured: Boolean(process.env.XAI_API_KEY),
  };
}

async function loadDesk() {
  return stationRpc<DeskPayload>("bvs_station_desk", { p_programme_id: PROGRAMME_ID });
}

export async function GET(request: Request) {
  if (!await identityFor(request)) return json({ error: "Programme access required." }, 403);
  const desk = await loadDesk();
  if (!desk.ok) return json({ error: "Station host is unavailable. Apply the station-host migration." }, 503);
  return json(presentDesk(desk.data));
}

async function rotationTrack(trackId: string) {
  const view = await stationRpc<{ rotation?: Array<Record<string, unknown>>; pronunciations?: Array<Record<string, unknown>>; control?: { voiceId?: string } }>("bvs_station_engine_view", { p_programme_id: PROGRAMME_ID });
  if (!view.ok || !view.data) return null;
  const track = (view.data.rotation || []).find((entry) => entry.id === trackId);
  if (!track) return null;
  return { track, pronunciations: view.data.pronunciations || [], voiceId: view.data.control?.voiceId || "ara" };
}

export async function POST(request: Request) {
  const identity = await identityFor(request);
  if (!identity) return json({ error: "Programme access required." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return json({ error: "Unknown station action." }, 400);
  const actor = identity.user.id;

  if (body.action === "set_host") {
    if (!Number.isSafeInteger(body.revision)) return json({ error: "Current revision required." }, 400);
    const enabled = body.enabled == null ? null : Boolean(body.enabled);
    const stop = body.stop == null ? null : Boolean(body.stop);
    const result = await stationRpc("bvs_station_set_host", {
      p_actor: actor, p_programme_id: PROGRAMME_ID, p_enabled: enabled, p_stop: stop, p_revision: body.revision,
    });
    if (!result.ok || !result.data) return conflict(result);
    return json({ ok: true });
  }

  if (body.action === "save_pronunciation") {
    if (typeof body.artistName !== "string" || typeof body.spokenForm !== "string" || !Number.isSafeInteger(body.revision)) return json({ error: "Artist, spoken form, and revision required." }, 400);
    const result = await stationRpc("bvs_station_save_pronunciation", {
      p_actor: actor, p_artist_name: body.artistName, p_spoken_form: body.spokenForm, p_as_written: body.asWritten === true, p_revision: body.revision,
    });
    if (!result.ok) return conflict(result);
    return json({ ok: true });
  }

  if (body.action === "review_pronunciation") {
    if (typeof body.artistKey !== "string" || (body.decision !== "approved" && body.decision !== "rejected") || !Number.isSafeInteger(body.revision)) return json({ error: "Pronunciation decision required." }, 400);
    const result = await stationRpc("bvs_station_review_pronunciation", {
      p_actor: actor, p_artist_key: body.artistKey, p_decision: body.decision, p_revision: body.revision,
    });
    if (!result.ok || !result.data) return conflict(result);
    return json({ ok: true });
  }

  if (body.action === "set_segment_status") {
    if (typeof body.id !== "string" || !UUID.test(body.id) || !Number.isSafeInteger(body.revision)) return json({ error: "Segment and revision required." }, 400);
    if (body.status !== "approved" && body.status !== "disabled" && body.status !== "rejected") return json({ error: "Unknown segment status." }, 400);
    const result = await stationRpc("bvs_station_set_segment_status", {
      p_actor: actor, p_id: body.id, p_status: body.status, p_revision: body.revision,
    });
    if (!result.ok || !result.data) return conflict(result);
    return json({ ok: true });
  }

  if (body.action === "save_segment") {
    if (typeof body.id !== "string" || !UUID.test(body.id) || typeof body.script !== "string" || !Number.isSafeInteger(body.revision)) return json({ error: "Segment, script, and revision required." }, 400);
    const desk = await loadDesk();
    const segment = ((desk.data?.segments || []) as Array<Record<string, unknown>>).find((entry) => entry.id === body.id);
    if (!segment || segment.kind !== "ai_voice") return json({ error: "Only an AI host line can be edited here." }, 404);
    const facts = segment.factSheet as ReturnType<typeof factSheet>;
    const checked = validateScript(body.script, facts);
    if (!facts || !checked.ok) return json({ error: "That line adds facts the desk cannot verify." }, 400);
    const result = await stationRpc("bvs_station_save_segment", {
      p_actor: actor, p_id: body.id, p_programme_id: PROGRAMME_ID, p_kind: "ai_voice", p_script: body.script,
      p_fact_sheet: facts, p_fingerprint: factFingerprint(facts), p_track_id: segment.trackId, p_artist_key: segment.artistKey,
      p_artist_name: facts.artistName, p_voice_id: process.env.BVS_HOST_VOICE_ID || "ara", p_revision: body.revision, p_error: null,
    });
    if (!result.ok || !result.data) return conflict(result);
    return json({ ok: true });
  }

  if (body.action === "save_human") {
    if ((body.kind !== "human_voice" && body.kind !== "guest") || typeof body.script !== "string" || body.script.trim().length < 2 || body.script.length > 800) {
      return json({ error: "A presenter or guest needs a short script." }, 400);
    }
    const trackId = typeof body.trackId === "string" && UUID.test(body.trackId) ? body.trackId : null;
    const id = crypto.randomUUID();
    const facts = { kind: body.kind, script: body.script.trim(), trackId, presenter: typeof body.presenter === "string" ? body.presenter.slice(0, 160) : "BVS" };
    const result = await stationRpc("bvs_station_save_segment", {
      p_actor: actor, p_id: id, p_programme_id: PROGRAMME_ID, p_kind: body.kind, p_script: facts.script,
      p_fact_sheet: facts, p_fingerprint: factFingerprint(facts),
      p_track_id: trackId, p_artist_key: null, p_artist_name: facts.presenter, p_voice_id: null, p_revision: 0, p_error: null,
    });
    if (!result.ok || !result.data) return conflict(result);
    return json({ id });
  }

  if (body.action === "generate") {
    if (typeof body.trackId !== "string" || !UUID.test(body.trackId)) return json({ error: "Track required." }, 400);
    const found = await rotationTrack(body.trackId);
    if (!found) return json({ error: "Track is not in the public approved rotation." }, 404);
    const pronunciation = pronunciationFor(found.track.artistName, found.pronunciations);
    if (pronunciation?.status !== "approved") return json({ error: "Approve the artist pronunciation before the host says this name." }, 409);
    const facts = factSheet(found.track, pronunciation);
    if (!facts) return json({ error: "Track is missing a title or artist." }, 400);
    let generated;
    try {
      generated = await generateHostLine(facts, { voiceId: String(found.voiceId || "ara") });
    } catch {
      return json({ error: "A grounded host line could not be built. Music continues without it." }, 422);
    }
    const id = crypto.randomUUID();
    const saved = await stationRpc<{ revision?: number }>("bvs_station_save_segment", {
      p_actor: actor, p_id: id, p_programme_id: PROGRAMME_ID, p_kind: "ai_voice", p_script: generated.script,
      p_fact_sheet: generated.facts, p_fingerprint: generated.fingerprint, p_track_id: body.trackId,
      p_artist_key: artistKey(String(found.track.artistName || "")), p_artist_name: facts.artistName,
      p_voice_id: found.voiceId || "ara", p_revision: 0, p_error: generated.speechError || null,
    });
    if (!saved.ok || !saved.data) return conflict(saved);
    if (generated.audio && durationAcceptable("ai_voice", generated.audio.durationSeconds)) {
      const audioKey = stationAudioKey(id, "mp3");
      if (!audioKey) return json({ error: "Host line was saved without audio." }, 201);
      try {
        await writeStationAudio(audioKey, generated.audio.audio, generated.audio.contentType || "audio/mpeg");
        const attached = await stationRpc("bvs_station_attach_audio", {
          p_id: id, p_audio_key: audioKey, p_duration: generated.audio.durationSeconds, p_revision: Number(saved.data.revision) || 0,
        });
        if (!attached.ok) return json({ id, audio: false, error: "The line is saved. Audio could not be attached, so it cannot air yet." }, 202);
      } catch {
        return json({ id, audio: false, error: "The line is saved. Audio could not be stored, so it cannot air yet." }, 202);
      }
      return json({ id, audio: true, source: generated.source });
    }
    return json({ id, audio: false, speech: generated.speechError || "Preview audio was not produced." }, 202);
  }

  return json({ error: "Unknown station action." }, 400);
}
