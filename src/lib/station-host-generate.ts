import "server-only";

import {
  chooseScript,
  durationAcceptable,
  durationFromTtsResponse,
  factFingerprint,
  scriptPrompt,
  textFromResponsesApi,
  ttsRequestBody,
  type HostFacts,
} from "@/lib/station-host.mjs";

const RESPONSES_URL = "https://api.x.ai/v1/responses";
const TTS_URL = "https://api.x.ai/v1/tts";

export async function generateHostLine(facts: HostFacts, options: {
  voiceId?: string;
  fetchImpl?: typeof fetch;
  apiKey?: string;
} = {}) {
  const voiceId = options.voiceId || process.env.BVS_HOST_VOICE_ID || "ara";
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const apiKey = options.apiKey ?? process.env.XAI_API_KEY ?? "";
  let modelText = "";
  if (apiKey) {
    try {
      const response = await fetchImpl(RESPONSES_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "grok-4.7", input: scriptPrompt(facts), store: false }),
        signal: AbortSignal.timeout(20000),
      });
      if (response.ok) modelText = textFromResponsesApi(await response.json());
    } catch {
      modelText = "";
    }
  }
  const chosen = chooseScript(facts, modelText);
  let audio: { audio: Buffer; durationSeconds: number; contentType: string } | null = null;
  let speechError = apiKey ? "" : "Speech key is not configured.";
  if (apiKey) {
    try {
      const replace = facts.spokenName !== facts.artistName ? { [facts.artistName]: facts.spokenName } : undefined;
      const response = await fetchImpl(TTS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(ttsRequestBody({ text: chosen.script, voiceId, replace })),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) speechError = "Speech synthesis was not accepted.";
      else {
        const parsed = durationFromTtsResponse(response.headers.get("content-type"), Buffer.from(await response.arrayBuffer()));
        if (!durationAcceptable("ai_voice", parsed.durationSeconds)) speechError = "Speech length was outside 8 to 15 seconds.";
        else audio = parsed;
      }
    } catch {
      speechError = "Speech synthesis failed.";
    }
  }
  return { script: chosen.script, source: chosen.source, fingerprint: factFingerprint(facts), facts, audio, speechError };
}
