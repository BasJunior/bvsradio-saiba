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
  export function chooseScript(facts: HostFacts, modelText?: string, session?: { style?: string } | null): { script: string; source: string };
  export type HostSession = {
    id: string;
    name: string;
    hostName: string;
    voiceId: string;
    startsMinute: number;
    endsMinute: number;
    speed: number;
    softness: string;
    style: string;
  };

  export const STATION_TIME_ZONE: string;
  export const DEFAULT_HOST_ROSTER: HostSession[];
  export function normalizeRoster(roster?: Array<Record<string, unknown>> | null): HostSession[];
  export function hostSessionAt(value: Date | string | number, roster?: Array<Record<string, unknown>> | null): HostSession;
  export function scriptPrompt(facts: HostFacts, session?: { style?: string } | null): string;
  export function textFromResponsesApi(payload: unknown): string;
  export function ttsRequestBody(input: { text: string; voiceId?: string; replace?: Record<string, string>; speed?: number; softness?: string }): Record<string, unknown>;
  export function durationFromTtsResponse(contentType: string | null, body: Uint8Array): { audio: Buffer; durationSeconds: number; contentType: string };
  export function durationAcceptable(kind: string, seconds: unknown): boolean;
  export function stationAudioKey(id: string, extension?: string): string | null;
  export function localAudioFile(audioKey: string, dir?: string): string | null;
  export function safeError(error: unknown): string;
}
