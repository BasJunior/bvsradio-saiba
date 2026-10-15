import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  ffmpegIcecastArgs,
  icecastSourceUrl,
  localAudioFile,
  planExtension,
  redactStreamUrl,
  safeError,
} from "../../src/lib/station-host.mjs";
import { reportSignalStarted } from "./signal-reporter.mjs";

function iso(value) {
  const time = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(time.getTime())) throw new Error("Invalid playout time");
  return time.toISOString();
}

function httpsPublicUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (url.username || url.password || url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function deliver(reporter, store, programmeId, event, log) {
  if (!reporter || !event?.eventId || !event?.trackId) return;
  let startedAt = "";
  try {
    startedAt = iso(event.startedAt);
    await reporter({ eventId: event.eventId, trackId: event.trackId, startedAt });
    await store.markDelivered(programmeId, event.eventId);
  } catch (error) {
    await store.noteDelivery(programmeId, event.eventId, safeError(error)).catch(() => {});
    log(safeError(error));
  }
}

async function settleOnAir(item, ctx) {
  const started = Date.parse(item.startedAt);
  const remainingMs = started + Number(item.durationSeconds) * 1000 - ctx.now().getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 400) {
    await ctx.store.finish(ctx.programmeId, item.id);
    return;
  }
  try {
    await ctx.output.untilEnd({ ...item, durationSeconds: remainingMs / 1000 }, abortContext(item, ctx));
    await ctx.store.finish(ctx.programmeId, item.id);
  } catch (error) {
    if (item.kind === "music") await ctx.store.finish(ctx.programmeId, item.id);
    else await ctx.store.fail(ctx.programmeId, item.id, error?.code === "HOST_STOPPED" ? "host_stopped" : "playback_failed");
    ctx.log(safeError(error));
  }
}

function abortContext(item, ctx) {
  return {
    signal: ctx.signal,
    shouldAbort: async () => {
      if (item.kind === "music" || ctx.signal?.aborted) return Boolean(ctx.signal?.aborted && item.kind !== "music");
      const control = (await ctx.store.view(ctx.programmeId)).control || {};
      return !control.enabled || Boolean(control.hostStopped);
    },
  };
}

async function playScheduled(item, ctx) {
  if (item.kind !== "music") {
    const control = (await ctx.store.view(ctx.programmeId)).control || {};
    if (!control.enabled || control.hostStopped) {
      await ctx.store.fail(ctx.programmeId, item.id, control.hostStopped ? "host_stopped" : "host_disabled");
      return;
    }
  }
  try {
    await ctx.output.open(item);
  } catch (error) {
    await ctx.store.fail(ctx.programmeId, item.id, item.kind === "music" ? "playback_failed" : "segment_unavailable");
    ctx.log(safeError(error));
    return;
  }
  let begun;
  try {
    begun = await ctx.store.begin(ctx.programmeId, item.id, ctx.engineId, ctx.now().toISOString());
  } catch (error) {
    await ctx.output.cancel?.();
    await ctx.store.fail(ctx.programmeId, item.id, "playback_failed").catch(() => {});
    ctx.log(safeError(error));
    return;
  }
  if (!begun || begun.skipped || begun.closed || begun.missing || begun.busy) {
    await ctx.output.cancel?.();
    return;
  }
  // Scheduling can never reach this reporter. A voice row cannot either, even if a store bug sets acknowledge.
  if (begun.acknowledge && item.kind === "music" && begun.trackId) {
    await deliver(ctx.reporter, ctx.store, ctx.programmeId, {
      eventId: begun.eventId,
      trackId: begun.trackId,
      startedAt: begun.startedAt,
    }, ctx.log);
  }
  try {
    await ctx.output.untilEnd(item, abortContext(item, ctx));
    await ctx.store.finish(ctx.programmeId, item.id);
  } catch (error) {
    if (item.kind === "music") await ctx.store.finish(ctx.programmeId, item.id);
    else await ctx.store.fail(ctx.programmeId, item.id, error?.code === "HOST_STOPPED" ? "host_stopped" : "playback_failed");
    ctx.log(safeError(error));
  }
}

export async function runStationEngine({
  programmeId = "bvs-main",
  engineId = "bvs-station-engine",
  store,
  output,
  reporter,
  now = () => new Date(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  maxSteps = Number.POSITIVE_INFINITY,
  horizon = 8,
  signal,
  log = () => {},
} = {}) {
  if (!store || !output) throw new Error("Playout engine needs a store and an output.");
  const ctx = { programmeId, engineId, store, output, reporter, now, sleep, signal, log };
  let steps = 0;
  while (steps < maxSteps && !signal?.aborted) {
    steps += 1;
    try {
      await store.heartbeat(programmeId, engineId, output.mode, output.livePublicUrl || null);
    } catch (error) {
      log(safeError(error));
    }
    let view = await store.view(programmeId);
    for (const pending of view?.undelivered || []) await deliver(reporter, store, programmeId, pending, log);
    if (view?.onAir?.id) {
      await settleOnAir(view.onAir, ctx);
      continue;
    }
    if ((view?.scheduled || []).length < 2) {
      const items = planExtension({
        rotation: view?.rotation || [],
        segments: view?.segments || [],
        pronunciations: view?.pronunciations || [],
        musicSinceVoice: view?.musicSinceVoice,
        voiceSlotIndex: view?.voiceSlotIndex,
        nextPosition: view?.nextPosition,
        settings: view?.control,
        usedSegmentIds: view?.usedSegmentIds || [],
        horizon,
        now: now(),
      });
      if (items.length) await store.plan(programmeId, items);
      view = await store.view(programmeId);
    }
    const nextItem = view?.scheduled?.[0];
    if (!nextItem) {
      await sleep(500);
      continue;
    }
    await playScheduled(nextItem, ctx);
  }
  return { steps };
}

export function supabaseStore(env = process.env, fetchImpl = fetch) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role is not configured.");
  async function rpc(name, body) {
    const response = await fetchImpl(`${String(url).replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "error",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) throw new Error("Station store rejected a playout call.");
    return payload;
  }
  return {
    view: (programmeId) => rpc("bvs_station_engine_view", { p_programme_id: programmeId }),
    plan: (programmeId, items) => rpc("bvs_station_plan_items", { p_programme_id: programmeId, p_items: items }),
    begin: (programmeId, itemId, engineId, startedAt) => rpc("bvs_station_begin_item", {
      p_programme_id: programmeId, p_item_id: itemId, p_engine_id: engineId, p_started_at: startedAt,
    }),
    finish: (programmeId, itemId) => rpc("bvs_station_finish_item", { p_programme_id: programmeId, p_item_id: itemId }),
    fail: (programmeId, itemId, reason) => rpc("bvs_station_fail_item", { p_programme_id: programmeId, p_item_id: itemId, p_reason: reason }),
    heartbeat: (programmeId, engineId, outputMode, liveUrl) => rpc("bvs_station_heartbeat", {
      p_programme_id: programmeId, p_engine_id: engineId, p_output_mode: outputMode, p_live_url: liveUrl,
    }),
    markDelivered: (programmeId, eventId) => rpc("bvs_station_mark_delivered", { p_programme_id: programmeId, p_event_id: eventId }),
    noteDelivery: (programmeId, eventId, error) => rpc("bvs_station_note_delivery", { p_programme_id: programmeId, p_event_id: eventId, p_error: error }),
  };
}

function wait(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

async function clockUntilEnd(item, ctx, sleep) {
  let left = Math.max(0, Number(item.durationSeconds) * 1000);
  while (left > 0) {
    if (ctx?.signal?.aborted && item.kind !== "music") {
      const error = new Error("Host stopped");
      error.code = "HOST_STOPPED";
      throw error;
    }
    if (await ctx?.shouldAbort?.()) {
      const error = new Error("Host stopped");
      error.code = "HOST_STOPPED";
      throw error;
    }
    const slice = Math.min(200, left);
    await sleep(slice);
    left -= slice;
  }
}

export function simulateOutput({ failOpen, sleep = (ms) => wait(ms), onOpen } = {}) {
  return {
    mode: "simulate",
    livePublicUrl: null,
    async open(item) {
      if (failOpen?.(item)) throw new Error("Audio file unavailable");
      onOpen?.(item);
    },
    async untilEnd(item, ctx) { await clockUntilEnd(item, ctx, sleep); },
    async cancel() {},
  };
}

export function timelineOutput({ sleep = (ms) => wait(ms) } = {}) {
  return {
    mode: "timeline",
    livePublicUrl: null,
    async open(item) {
      if (item?.kind === "music" && !item.audioRef) throw new Error("Music audio is missing");
      if (item?.kind !== "music" && !item?.audioRef) throw new Error("Voice audio is missing");
    },
    async untilEnd(item, ctx) { await clockUntilEnd(item, ctx, sleep); },
    async cancel() {},
  };
}

async function ffmpegInput(item) {
  const local = localAudioFile(item?.audioRef || "");
  if (local) {
    try { await access(local); return local; } catch { /* shared storage or app origin */ }
  }
  if (/^https:\/\//i.test(item?.audioRef || "")) return item.audioRef;
  const origin = process.env.BVS_APP_ORIGIN;
  if (item?.segmentId && origin && /^https:\/\//i.test(origin)) return `${origin.replace(/\/$/, "")}/api/station/voice/${item.segmentId}`;
  return null;
}

export async function createIcecastOutput({ env = process.env, spawnImpl = spawn, log = () => {} } = {}) {
  const source = icecastSourceUrl({
    host: env.BVS_ICECAST_HOST,
    port: Number(env.BVS_ICECAST_PORT || 8000),
    mount: env.BVS_ICECAST_MOUNT || "/bvs",
    password: env.BVS_ICECAST_SOURCE_PASSWORD,
  });
  if (!source) return null;
  try {
    const probe = spawnImpl(env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-version"], { stdio: "ignore" });
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.once("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg unavailable"))));
    });
  } catch {
    log("ffmpeg is not available. Station audio continues on the programme clock.");
    return null;
  }
  let child = null;
  const stopChild = () => {
    if (!child || child.killed) return;
    child.kill("SIGTERM");
    child = null;
  };
  return {
    mode: "icecast",
    livePublicUrl: httpsPublicUrl(env.BVS_LIVE_STREAM_PUBLIC_URL),
    async open(item) {
      stopChild();
      const input = await ffmpegInput(item);
      if (!input) throw new Error("Audio input unavailable");
      child = spawnImpl(env.FFMPEG_PATH || "ffmpeg", ffmpegIcecastArgs(input, source.url), { stdio: ["ignore", "ignore", "pipe"] });
      child.stderr?.on("data", (chunk) => {
        const line = redactStreamUrl(String(chunk));
        if (/error|fail/i.test(line)) log(safeError({ message: line }));
      });
      const started = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("spawn", () => resolve(true));
      });
      if (!started) throw new Error("Audio encoder did not start");
    },
    async untilEnd(item, ctx) {
      const encoder = child;
      if (!encoder) throw new Error("Audio encoder is not running");
      await new Promise((resolve, reject) => {
        const timer = setInterval(() => {
          ctx?.shouldAbort?.().then((stop) => {
            if (!stop) return;
            clearInterval(timer);
            stopChild();
            const error = new Error("Host stopped");
            error.code = "HOST_STOPPED";
            reject(error);
          }).catch(() => {});
        }, 300);
        encoder.once("exit", (code) => {
          clearInterval(timer);
          if (code === 0 || code === null) resolve();
          else reject(new Error("Audio encoder stopped"));
        });
        encoder.once("error", (error) => { clearInterval(timer); reject(error); });
      });
    },
    async cancel() { stopChild(); },
  };
}

async function main() {
  let store;
  try {
    store = supabaseStore();
  } catch (error) {
    console.error(safeError(error));
    process.exitCode = 1;
    return;
  }
  const requested = process.env.BVS_PLAYOUT_OUTPUT || "timeline";
  let output = timelineOutput();
  if (requested === "simulate") output = simulateOutput();
  if (requested === "icecast") {
    output = await createIcecastOutput({ log: (line) => console.error(line) }) || timelineOutput();
  }
  await runStationEngine({
    store,
    output,
    reporter: (event) => reportSignalStarted(event),
    log: (line) => console.error(line),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(safeError(error));
    process.exitCode = 1;
  });
}
