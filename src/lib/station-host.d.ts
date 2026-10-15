declare module "@/lib/station-host.mjs" {
  export const PROGRAMME_ID: string;
  export const VOICE_MIN_SECONDS: number;
  export const VOICE_MAX_SECONDS: number;

  export type HostFacts = {
    artistName: string;
    spokenName: string;
    title: string;
    genre: string | null;
    editorialReason: string | null;
    priorBroadcasts: number;
    firstSpinAired: boolean;
    firstSpinDate: string | null;
  };

  export function artistKey(name: unknown): string;
  export function factSheet(track: Record<string, unknown> | null | undefined, pronunciation?: Record<string, unknown> | null): HostFacts | null;
  export function factFingerprint(facts: object): string;
  export function pronunciationFor(artistName: unknown, pronunciations?: Array<Record<string, unknown>>): Record<string, unknown> | null;
  export function validateScript(script: string, facts: HostFacts | null | undefined): { ok: boolean; reasons: string[] };
  export function chooseScript(facts: HostFacts, modelText?: string): { script: string; source: string };
  export function scriptPrompt(facts: HostFacts): string;
  export function textFromResponsesApi(payload: unknown): string;
  export function ttsRequestBody(input: { text: string; voiceId?: string; replace?: Record<string, string> }): Record<string, unknown>;
  export function durationFromTtsResponse(contentType: string | null, body: Uint8Array): { audio: Buffer; durationSeconds: number; contentType: string };
  export function durationAcceptable(kind: string, seconds: unknown): boolean;
  export function stationAudioKey(id: string, extension?: string): string | null;
  export function localAudioFile(audioKey: string, dir?: string): string | null;
  export function safeError(error: unknown): string;
}
