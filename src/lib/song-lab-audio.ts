/**
 * Local prototype media storage + client-side demo renderer.
 * Lyrics remain in the existing authenticated BVS workspace; voice takes stay
 * in this browser until cloud-private media uploads are implemented.
 */
export type SongLabTake = {
  id: string;
  workspaceId: string;
  label: string;
  startSec: number;
  createdAt: number;
  blob: Blob;
  gain: number;
  muted: boolean;
  transcript: string;
};

const DB_NAME = "bvs-song-lab-local-v1";
const TABLE = "takes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TABLE)) db.createObjectStore(TABLE, { keyPath: "id" });
    };
    request.onerror = () => reject(request.error || new Error("Browser storage unavailable."));
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TABLE, mode);
    const store = transaction.objectStore(TABLE);
    let value: T;
    run(store, (next) => { value = next; });
    transaction.oncomplete = () => { db.close(); resolve(value); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error("Browser storage error.")); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Browser storage aborted.")); };
  });
}

export async function listLocalTakes(workspaceId: string): Promise<SongLabTake[]> {
  const all = await withStore<SongLabTake[]>("readonly", (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => done((request.result || []) as SongLabTake[]);
  });
  return all.filter((take) => take.workspaceId === workspaceId).sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveLocalTake(take: SongLabTake): Promise<void> {
  await withStore<void>("readwrite", (store) => { store.put(take); });
}

export async function deleteLocalTake(id: string): Promise<void> {
  await withStore<void>("readwrite", (store) => { store.delete(id); });
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const samples = buffer.length;
  const bytes = new ArrayBuffer(44 + samples * channels * 2);
  const view = new DataView(bytes);
  const write = (offset: number, word: string) => {
    for (let i = 0; i < word.length; i++) view.setUint8(offset + i, word.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * channels * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * channels * 2, true);
  const audio = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
  for (let frame = 0; frame < samples; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, audio[channel][frame]));
      view.setInt16(44 + (frame * channels + channel) * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export async function renderSongLabDemo(args: {
  beat: Blob;
  takes: SongLabTake[];
  beatGain: number;
  vocalGain: number;
  polish: boolean;
}): Promise<Blob> {
  const decoder = new AudioContext();
  let beat: AudioBuffer;
  let vocals: Array<{ take: SongLabTake; buffer: AudioBuffer }>;
  try {
    beat = await decoder.decodeAudioData(await args.beat.arrayBuffer());
    vocals = await Promise.all(args.takes.filter((take) => !take.muted).map(async (take) => ({
      take,
      buffer: await decoder.decodeAudioData(await take.blob.arrayBuffer()),
    })));
  } finally {
    await decoder.close();
  }

  const rate = 44100;
  const duration = Math.max(
    beat.duration,
    ...vocals.map(({ take, buffer }) => take.startSec + buffer.duration),
  ) + 0.2;
  if (duration > 6 * 60) throw new Error("Local demo exports are limited to six minutes.");
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * rate), rate);
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -8;
  master.knee.value = 12;
  master.ratio.value = 3;
  master.attack.value = 0.004;
  master.release.value = 0.2;
  master.connect(ctx.destination);

  const instrumental = ctx.createBufferSource();
  instrumental.buffer = beat;
  const beatLevel = ctx.createGain();
  beatLevel.gain.value = Math.max(0, Math.min(1.5, args.beatGain));
  instrumental.connect(beatLevel).connect(master);
  instrumental.start(0);

  for (const { take, buffer } of vocals) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(2, take.gain * args.vocalGain));
    if (args.polish) {
      const highPass = ctx.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.value = 90;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -22;
      compressor.knee.value = 16;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.15;
      source.connect(highPass).connect(compressor).connect(gain).connect(master);
    } else {
      source.connect(gain).connect(master);
    }
    source.start(Math.max(0, take.startSec));
  }

  return encodeWav(await ctx.startRendering());
}
