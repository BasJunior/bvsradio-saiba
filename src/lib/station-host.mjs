import { createHash } from "node:crypto";
import path from "node:path";

export const PROGRAMME_ID = "bvs-main";
export const STATION_TIME_ZONE = "Africa/Harare";
export const VOICE_MIN_SECONDS = 8;
export const VOICE_MAX_SECONDS = 15;
export const HUMAN_MIN_SECONDS = 2;
export const HUMAN_MAX_SECONDS = 900;

/** Day boundaries stay here so the engine and the listener guide share one clock. */
export const DEFAULT_HOST_ROSTER = [
  { id: "daytime", name: "Daytime", hostName: "Ara", voiceId: "ara", startsMinute: 6 * 60, endsMinute: 16 * 60, speed: 1, softness: "soft", style: "warm" },
  { id: "evening", name: "Evening", hostName: "Rex", voiceId: "rex", startsMinute: 16 * 60, endsMinute: 22 * 60, speed: 1.05, softness: "plain", style: "confident" },
  { id: "after-hours", name: "After hours", hostName: "Sal", voiceId: "sal", startsMinute: 22 * 60, endsMinute: 6 * 60, speed: 0.9, softness: "soft", style: "calm" },
];

const VOICE_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const PERSON_NAME = /^[A-Z][a-z]+(?:[ '-][A-Za-z][a-z]+){0,2}$/;

export function normalizeRoster(roster) {
  return DEFAULT_HOST_ROSTER.map((row) => {
    const override = Array.isArray(roster)
      ? roster.find((entry) => entry && (entry.id === row.id || entry.sessionId === row.id))
      : null;
    if (!override) return { ...row };
    const hostName = String(override.hostName || override.host_name || "").trim();
    const voiceId = String(override.voiceId || override.voice_id || "").trim();
    return {
      ...row,
      hostName: PERSON_NAME.test(hostName) && hostName.length <= 32 ? hostName : row.hostName,
      voiceId: VOICE_ID.test(voiceId) ? voiceId : row.voiceId,
    };
  });
}

export function minuteInTimeZone(value, timeZone = STATION_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return 0;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  let hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (hour === 24) hour = 0;
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return 0;
  return hour * 60 + minute;
}

export function sessionCovers(session, minute) {
  const start = Number(session?.startsMinute);
  const end = Number(session?.endsMinute);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
  if (start === end) return true;
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

export function hostSessionAt(value, roster) {
  const sessions = normalizeRoster(roster);
  const minute = minuteInTimeZone(value);
  return sessions.find((session) => sessionCovers(session, minute)) || sessions[0];
}

const CONNECTIVES = new Set(`a an the this that these those here there is are was were be been being and or but so of in on at to for with from by as into onto it its it's you your you're we our we'll here's that's just stay keep listening music song track station radio bvs one up next coming leave speak with us them now today tonight again back here's here`.split(/\s+/));
const DENY = new Set("chart charts viral million billion award awards grammy grammys streams listeners listener produced producer producers written writer featuring ft platinum trending popular fans followers views debut anniversary sold smash hit banger legendary iconic".split(/\s+/));

export function artistKey(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160);
}

export function tokens(text) {
  return String(text || "").toLowerCase().match(/\p{L}[\p{L}\p{N}'’]*/gu) || [];
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function factFingerprint(facts) {
  return createHash("sha256").update(canonical(facts)).digest("hex");
}

export function formatSpinDate(value) {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(time));
}

export function factSheet(track, pronunciation) {
  const artistName = String(track?.artistName || track?.artist_name || "").trim();
  const title = String(track?.title || "").trim();
  if (!artistName || !title) return null;
  const approved = pronunciation?.status === "approved" && String(pronunciation.spokenForm || pronunciation.spoken_form || "").trim();
  const priorBroadcasts = Math.max(0, Number(track.priorBroadcasts ?? track.prior_broadcasts ?? 0) || 0);
  const firstSpinAt = track.firstSpinAt || track.first_spin_at || null;
  const reason = String(track.editorialReason || track.editorial_reason || "").trim();
  return {
    artistName,
    spokenName: approved || artistName,
    title,
    genre: String(track.genre || "").trim() || null,
    editorialReason: reason || null,
    priorBroadcasts,
    firstSpinAired: Boolean(firstSpinAt),
    firstSpinDate: firstSpinAt ? formatSpinDate(firstSpinAt) : null,
  };
}

export function wordCount(script) {
  return tokens(script).length;
}

function allowedWords(facts) {
  const allowed = new Set(CONNECTIVES);
  for (const value of Object.values(facts)) {
    if (typeof value === "string") for (const token of tokens(value)) allowed.add(token);
    if (typeof value === "number") allowed.add(String(value));
  }
  if (facts.priorBroadcasts === 0) {
    allowed.add("first");
    allowed.add("time");
  }
  if (facts.firstSpinAired) {
    allowed.add("first");
    allowed.add("spin");
    allowed.add("aired");
  }
  if (facts.editorialReason) {
    allowed.add("selected");
    allowed.add("because");
  }
  return allowed;
}

export function validateScript(script, facts) {
  const reasons = [];
  const text = String(script || "").trim();
  if (!facts?.artistName || !facts?.title) reasons.push("missing facts");
  if (text.length < 12 || text.length > 800) reasons.push("length");
  const count = wordCount(text);
  if (count < 12 || count > 42) reasons.push("word count");
  if (/\bfirst\s+spin\b/i.test(text) && !facts?.firstSpinAired) reasons.push("unproved First Spin");
  if (/\bfirst\b/i.test(text) && facts?.priorBroadcasts !== 0 && !facts?.firstSpinAired) reasons.push("first-time claim");
  if (/\bfirst\b/i.test(text) && facts?.priorBroadcasts === 0 && !/\bfirst\s+time\b/i.test(text)) reasons.push("first-time phrasing");
  const factTokens = new Set();
  for (const value of Object.values(facts || {})) {
    if (typeof value === "string") for (const token of tokens(value)) factTokens.add(token);
  }
  const allowed = facts ? allowedWords(facts) : new Set();
  for (const token of tokens(text)) {
    if (DENY.has(token) && !factTokens.has(token)) reasons.push(`invented:${token}`);
    else if (!allowed.has(token)) reasons.push(`outside:${token}`);
  }
  if (facts?.spokenName && !text.toLowerCase().includes(String(facts.spokenName).toLowerCase())) reasons.push("missing artist");
  if (facts?.title && !text.toLowerCase().includes(String(facts.title).toLowerCase())) reasons.push("missing title");
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function usableReason(facts) {
  const reason = String(facts.editorialReason || "").trim();
  if (!reason || wordCount(reason) > 14) return "";
  return /[.!?]$/.test(reason) ? reason : `${reason}.`;
}

export function deterministicScript(facts, session) {
  const name = facts.spokenName;
  const title = facts.title;
  const reason = usableReason(facts);
  const first = facts.priorBroadcasts === 0;
  const style = session?.style || "warm";
  const opening = first ? "First time on BVS for this one." : "Back on the BVS station.";
  const intro = `Here's ${name}, with ${title}.`;
  let script;
  if (style === "confident") {
    script = reason ? `${opening} ${intro} ${reason}` : `${opening} ${intro} We'll leave the song to speak.`;
  } else if (style === "calm") {
    script = first
      ? `${opening} ${intro} We'll leave the song to speak.`
      : `Here's ${name}, with ${title}, on BVS. We'll leave the song to speak.`;
  } else {
    const middle = reason || "We'll leave the song to speak.";
    script = `${opening} ${intro} ${middle} Stay with the music.`;
  }
  if (!validateScript(script, facts).ok) {
    script = first
      ? `First time on BVS for this one. Here's ${name}, with ${title}. Stay with the music.`
      : `Here's ${name}, with ${title}, on BVS. Stay with the music.`;
  }
  return script.replace(/\s+/g, " ").trim();
}

export function chooseScript(facts, modelText, session) {
  const candidate = String(modelText || "").replace(/\s+/g, " ").trim();
  const checked = candidate ? validateScript(candidate, facts) : { ok: false };
  if (checked.ok && wordCount(candidate) <= 36) return { script: candidate, source: "model" };
  const script = deterministicScript(facts, session);
  const fallback = validateScript(script, facts);
  if (!fallback.ok) {
    const error = new Error("Grounded script could not be built.");
    error.reasons = fallback.reasons;
    throw error;
  }
  return { script, source: "grounded" };
}

export function voiceGap(voiceSlotIndex, settings = {}) {
  const minGap = clampInt(settings.minGap ?? 3, 3, 5);
  const maxGap = Math.max(minGap, clampInt(settings.maxGap ?? 5, 3, 5));
  const pattern = [];
  for (let gap = minGap; gap <= maxGap; gap += 1) pattern.push(gap);
  const longEvery = Number(settings.longEvery ?? 6);
  if (longEvery > 0 && voiceSlotIndex > 0 && voiceSlotIndex % longEvery === 0) return Number(settings.longGap ?? 8);
  return pattern[voiceSlotIndex % pattern.length];
}

function clampInt(value, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function durationAcceptable(kind, seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return false;
  if (kind === "ai_voice") return value >= VOICE_MIN_SECONDS && value <= VOICE_MAX_SECONDS;
  if (kind === "human_voice" || kind === "guest") return value >= HUMAN_MIN_SECONDS && value <= HUMAN_MAX_SECONDS;
  return value > 0 && value <= 60 * 30;
}

function itemId() {
  return globalThis.crypto.randomUUID();
}

export function pronunciationFor(artistName, pronunciations = []) {
  const key = artistKey(artistName);
  return (pronunciations || []).find((entry) => entry?.artistKey === key || entry?.artist_key === key || artistKey(entry?.artistName || entry?.artist_name || "") === key) || null;
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function advance(date, seconds) {
  return new Date(date.getTime() + Math.max(0, Number(seconds) || 0) * 1000);
}

function segmentUsable(segment) {
  return Boolean(segment && segment.status === "approved" && segment.audioKey && durationAcceptable(segment.kind, segment.durationSeconds));
}

function labelForVoice(voice, roster) {
  if (voice.kind === "guest") return { title: "BVS guest", artistName: "BVS Radio" };
  if (voice.kind === "human_voice") return { title: "BVS presenter", artistName: "BVS Radio" };
  const match = normalizeRoster(roster).find((session) => session.voiceId === voice.voiceId);
  if (match) return { title: match.hostName, artistName: match.name };
  return { title: "BVS host", artistName: "BVS Radio" };
}

export function planExtension({
  rotation,
  segments = [],
  pronunciations = [],
  musicSinceVoice = 0,
  voiceSlotIndex = 0,
  nextPosition = 1,
  settings,
  usedSegmentIds = [],
  horizon = 8,
  now = new Date(),
}) {
  const enabled = Boolean(settings?.enabled) && !settings?.hostStopped;
  const roster = normalizeRoster(settings?.roster);
  const used = new Set(usedSegmentIds);
  const usable = (segments || []).filter(segmentUsable);
  const tracks = (rotation || []).filter((track) => track?.id && track.title && track.artistName && track.audioRef);
  if (!tracks.length || horizon <= 0) return [];
  const items = [];
  let since = Number(musicSinceVoice) || 0;
  let slot = Number(voiceSlotIndex) || 0;
  let position = Number(nextPosition) || 1;
  let cursor = 0;
  let plannedMusic = 0;
  let guard = 0;
  let at = asDate(now);
  const matchesTrack = (pool, entry) => {
    const candidate = pool.find((segment) => segment.trackId === entry.id && !used.has(segment.id));
    if (!candidate) return null;
    const entryFacts = factSheet(entry, pronunciationFor(entry.artistName, pronunciations));
    if (!entryFacts || candidate.factFingerprint !== factFingerprint(entryFacts)) return null;
    return candidate;
  };
  while (plannedMusic < horizon && guard < horizon * 4) {
    guard += 1;
    let track = tracks[cursor % tracks.length];
    cursor += 1;
    if (items.at(-1)?.trackId === track.id && tracks.length > 1) continue;
    if (enabled && since >= voiceGap(slot, settings)) {
      const session = hostSessionAt(at, roster);
      const floating = usable.find((entry) => !entry.trackId && entry.kind !== "ai_voice" && !used.has(entry.id));
      const sessionClips = usable.filter((entry) => entry.kind === "ai_voice" && entry.voiceId === session.voiceId);
      const aiPool = sessionClips.length ? sessionClips : usable.filter((entry) => entry.kind === "ai_voice");
      const tied = usable.filter((entry) => entry.kind !== "ai_voice" && entry.trackId);
      const pool = [...tied, ...aiPool];
      let voice = floating || matchesTrack(pool, track);
      if (!voice) {
        const intro = tracks.find((entry) => entry.id !== items.at(-1)?.trackId && matchesTrack(pool, entry))
          || tracks.find((entry) => matchesTrack(pool, entry));
        if (intro) {
          track = intro;
          voice = matchesTrack(pool, intro);
        }
      }
      if (voice) {
        const id = itemId();
        const label = labelForVoice(voice, roster);
        items.push({
          id,
          position,
          kind: voice.kind,
          trackId: voice.trackId || null,
          segmentId: voice.id,
          eventId: `voice:${id}`,
          title: label.title,
          artistName: label.artistName,
          audioRef: voice.audioKey,
          durationSeconds: Number(voice.durationSeconds),
        });
        used.add(voice.id);
        position += 1;
        slot += 1;
        since = 0;
        at = advance(at, voice.durationSeconds);
      } else since = 0;
    }
    const musicId = itemId();
    const musicDuration = Number(track.durationSeconds) > 0 ? Number(track.durationSeconds) : 180;
    items.push({
      id: musicId,
      position,
      kind: "music",
      trackId: track.id,
      segmentId: null,
      eventId: `music:${musicId}`,
      title: track.title,
      artistName: track.artistName,
      audioRef: track.audioRef,
      durationSeconds: musicDuration,
    });
    position += 1;
    since += 1;
    plannedMusic += 1;
    at = advance(at, musicDuration);
  }
  return items;
}

export function scriptPrompt(facts, session) {
  const delivery = session?.style === "confident"
    ? "Sound confident and direct."
    : session?.style === "calm"
      ? "Sound calm and brief. Leave room for the music."
      : "Sound welcoming and specific.";
  return [
    "Write one spoken line for the BVS Radio host.",
    delivery,
    "No hype, no slogans, no extra facts.",
    "Use only the JSON facts. Do not add popularity, places, credits, awards, or milestones.",
    "If priorBroadcasts is 0, you may say \"first time on BVS\" and you must not say \"First Spin\".",
    "Say \"First Spin\" only when firstSpinAired is true.",
    "Say the spokenName exactly. 18 to 34 words. Return only the spoken line.",
    JSON.stringify(facts),
  ].join("\n");
}

export function textFromResponsesApi(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const parts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("").trim();
}

export function ttsRequestBody({ text, voiceId = "ara", replace, speed = 0.95, softness = "soft" }) {
  const rate = Number(speed);
  const spoken = softness === "plain" ? text : `<soft>${text}</soft>`;
  const body = {
    text: spoken,
    voice_id: voiceId || "ara",
    language: "en",
    speed: Number.isFinite(rate) ? Math.min(1.5, Math.max(0.7, rate)) : 0.95,
    with_timestamps: true,
    output_format: { codec: "mp3", sample_rate: 44100, bit_rate: 128000 },
  };
  const clean = {};
  for (const [key, value] of Object.entries(replace || {})) {
    if (/^[\p{L}\p{N}' ]{1,100}$/u.test(key) && String(value || "").length <= 128) clean[key] = String(value);
  }
  if (Object.keys(clean).length) body.replace = clean;
  return body;
}

export function durationFromTtsResponse(contentType, body) {
  const type = String(contentType || "");
  if (type.includes("json") || (body.length && body[0] === 0x7b)) {
    const payload = JSON.parse(Buffer.from(body).toString("utf8"));
    const audio = Buffer.from(String(payload.audio || ""), "base64");
    const durationSeconds = Number(payload.duration);
    if (!audio.length || !Number.isFinite(durationSeconds)) throw new Error("Speech response was incomplete.");
    return { audio, durationSeconds, contentType: String(payload.content_type || "audio/mpeg") };
  }
  if (!body.length) throw new Error("Speech response was empty.");
  return { audio: Buffer.from(body), durationSeconds: (body.length * 8) / 128000, contentType: type || "audio/mpeg" };
}

export function redactStreamUrl(value) {
  return String(value || "").replace(/\/\/[^/\s@]+@/g, "//***@");
}

export function icecastSourceUrl({ host, port = 8000, mount = "/bvs", user = "source", password }) {
  if (!host || !password) return null;
  const safeMount = String(mount).startsWith("/") ? mount : `/${mount}`;
  const url = `icecast://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}${safeMount}`;
  return { url, logSafe: redactStreamUrl(url) };
}

export function ffmpegIcecastArgs(inputPath, sourceUrl) {
  return ["-hide_banner", "-nostats", "-re", "-i", inputPath, "-vn", "-c:a", "libmp3lame", "-b:a", "128k", "-content_type", "audio/mpeg", "-f", "mp3", sourceUrl];
}

const AUDIO_KEY = /^station-host\/[0-9a-f-]{36}\.(mp3|wav|m4a)$/i;

export function stationAudioKey(id, extension = "mp3") {
  const ext = ["mp3", "wav", "m4a"].includes(extension) ? extension : "";
  if (!ext || !/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  return `station-host/${String(id).toLowerCase()}.${ext}`;
}

export function localAudioFile(audioKey, dir = process.env.BVS_HOST_AUDIO_DIR || "var/station-host-audio") {
  const key = String(audioKey || "");
  if (!AUDIO_KEY.test(key)) return null;
  const root = path.resolve(dir);
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

export function safeError(error) {
  const message = String(error?.message || "Playback step failed.").replace(/bearer\s+\S+/gi, "bearer ***").slice(0, 180);
  if (/key|secret|password|token|authorization/i.test(message)) return "Playback step failed.";
  return message;
}
