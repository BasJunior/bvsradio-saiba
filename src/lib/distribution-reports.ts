export const distributionStores = ['Spotify', 'Apple Music', 'YouTube Music', 'Amazon Music', 'Deezer', 'Other'] as const;
export type DistributionReport = {
  id: string; release_id: string; artist_user_id: string; period_start: string; period_end: string;
  source: string; source_reference: string; updated_at: string;
  daily: Array<{ date: string; store: string; streams: number }>;
  countries: Array<{ code: string; streams: number }>;
};
const day = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export function validateDistributionReport(input: Record<string, unknown>) {
  if (!day(input.period_start) || !day(input.period_end) || String(input.period_start) > String(input.period_end) || String(input.period_end) > new Date().toISOString().slice(0,10)) throw new Error('Choose a valid reporting period ending today or earlier.');
  if (!Array.isArray(input.daily) || !input.daily.length || input.daily.length > 2200 || !Array.isArray(input.countries) || input.countries.length > 250) throw new Error('Add 1–2200 daily rows and up to 250 country rows.');
  const seen = new Set<string>();
  const count = (value: unknown) => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1e12) throw new Error('Streams must be non-negative whole numbers.'); return value; };
  const daily = input.daily.map(row => {
    if (!row || typeof row !== 'object') throw new Error('Invalid daily row.');
    const {date, store, streams} = row;
    if (!day(date) || date < String(input.period_start) || date > String(input.period_end) || !(distributionStores as readonly string[]).includes(store)) throw new Error('Daily rows need a date within the report and a supported store.');
    const key = `${date}:${store}`; if (seen.has(key)) throw new Error('Duplicate date/store row.'); seen.add(key);
    return {date: String(date), store: String(store), streams: count(streams)};
  });
  const codes = new Set<string>();
  const countries = input.countries.map(row => {
    if (!row || typeof row !== 'object' || typeof row.code !== 'string' || !/^[A-Z]{2}$/.test(row.code)) throw new Error('Countries need uppercase two-letter country codes.');
    if (codes.has(row.code)) throw new Error('Duplicate country row.'); codes.add(row.code);
    return {code: row.code, streams: count(row.streams)};
  });
  const total = daily.reduce((sum, row) => sum + row.streams, 0);
  if (countries.reduce((sum, row) => sum + row.streams, 0) > total) throw new Error('Country streams cannot exceed total reported streams.');
  if (typeof input.source_reference !== 'string' || !input.source_reference.trim() || input.source_reference.length > 300) throw new Error('Add the partner report reference (up to 300 characters).');
  return {period_start: String(input.period_start), period_end: String(input.period_end), source: 'amuse', source_reference: input.source_reference.trim(), daily, countries};
}
export function summarizeDistributionReport(report: Pick<DistributionReport, 'daily' | 'countries'>) {
  const days = new Map<string, number>(); const stores = new Map<string, number>();
  for (const row of report.daily) { days.set(row.date, (days.get(row.date) || 0) + row.streams); stores.set(row.store, (stores.get(row.store) || 0) + row.streams); }
  return {total: report.daily.reduce((sum,row) => sum + row.streams,0), daily: [...days].sort(([a],[b]) => a.localeCompare(b)).map(([date,streams]) => ({date,streams})), stores: [...stores].sort((a,b) => b[1]-a[1]), countries: [...report.countries].sort((a,b) => b.streams-a.streams)};
}

/** Membership and an actual distribution job are both required for the DSP desk. */
export function eligibleDistributionReleaseIds(
  premium: { premiumActive: boolean; distributionEnabled: boolean },
  jobs: Array<{ release_id?: string | null; status?: string | null; updated_at?: string | null }>,
) {
  if (!premium.premiumActive || !premium.distributionEnabled) return [];
  const latest = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) {
    if (!job.release_id) continue;
    const previous = latest.get(job.release_id);
    if (!previous || Date.parse(job.updated_at || '') > Date.parse(previous.updated_at || '')) latest.set(job.release_id, job);
  }
  return [...latest].filter(([,job]) => ['eligible', 'queued', 'submitted', 'processing', 'delivering', 'live_on_dsp', 'failed'].includes(job.status || '')).map(([id]) => id);
}
