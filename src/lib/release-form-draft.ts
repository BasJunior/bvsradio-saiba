export type ReleaseFormDraft = {
  title: string; explicit: boolean; genre: string; description: string; releaseType: string; trackTitles: string[];
  copyrightYear: string; masterOwner: string; compositionOwners: string; songwriters: string;
  producers: string; featuredArtists: string; materialTypes: string[]; evidenceNotes: Record<string,string>;
  fileNames: string[]; coverName: string;
};
export const releaseFormDraftKey = (owner: string, workspace = '') => `bvs.release-form.v1:${owner}:${workspace || 'new'}`;
export function parseReleaseFormDraft(raw: string | null): ReleaseFormDraft | null {
  if (!raw) return null;
  try {
    const {metadata, savedAt} = JSON.parse(raw);
    if (!metadata || !Number.isFinite(savedAt) || Date.now()-savedAt > 30*86400000) return null;
    const strings = ['title','genre','description','releaseType','copyrightYear','masterOwner','compositionOwners','songwriters','producers','featuredArtists','coverName'] as const;
    const result = {explicit: metadata.explicit === true} as ReleaseFormDraft;
    for (const key of strings) { if (typeof metadata[key] !== 'string' || metadata[key].length > 10000) return null; result[key]=metadata[key]; }
    for (const key of ['trackTitles','fileNames','materialTypes'] as const) { if (!Array.isArray(metadata[key]) || metadata[key].length > 30 || metadata[key].some((value:unknown)=>typeof value !== 'string' || value.length > 1000)) return null; result[key]=metadata[key]; }
    if (!metadata.evidenceNotes || typeof metadata.evidenceNotes !== 'object' || Array.isArray(metadata.evidenceNotes)) return null;
    result.evidenceNotes = {};
    for (const [key,value] of Object.entries(metadata.evidenceNotes)) { if (typeof value !== 'string' || value.length > 10000 || ['__proto__','constructor','prototype'].includes(key)) return null; result.evidenceNotes[key]=value; }
    return result;
  } catch { return null; }
}
