export type IncomeImportEntry = {
  sourceCategory: string;
  providerName: string;
  netAmount: string;
  grossAmount?: string;
  feesAmount?: string;
  currency: string;
  status: string;
  externalReference?: string;
  periodStart?: string;
  periodEnd?: string;
  occurredAt?: string;
  territory?: string;
  statementName?: string;
};

export type IncomeCsvFormat = "normalised" | "amuse";

const HEADER_ALIASES: Record<string, string> = {
  amount: "net_amount",
  artist: "artist",
  artist_name: "artist",
  country: "territory",
  date: "occurred_at",
  dsp: "store",
  end_date: "period_end",
  fees: "fees_amount",
  gross: "gross_amount",
  gross_amount: "gross_amount",
  isrc: "isrc",
  month: "period",
  net: "net_amount",
  net_amount: "net_amount",
  net_revenue: "net_amount",
  net_royalty: "net_amount",
  net_royalties: "net_amount",
  paid_amount: "net_amount",
  payee: "provider_name",
  payer: "provider_name",
  period_end: "period_end",
  period_start: "period_start",
  platform: "store",
  provider: "provider_name",
  provider_name: "provider_name",
  reference: "external_reference",
  release: "release_title",
  release_title: "release_title",
  report_month: "period",
  reporting_month: "period",
  royalty: "net_amount",
  royalties: "net_amount",
  sales_month: "period",
  service: "store",
  source: "source_category",
  source_category: "source_category",
  start_date: "period_start",
  status: "status",
  statement: "statement_name",
  statement_name: "statement_name",
  store: "store",
  territory: "territory",
  title: "track_title",
  track: "track_title",
  track_title: "track_title",
  transaction_id: "external_reference",
  upc: "upc",
};

function canonicalHeader(value: string) {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return HEADER_ALIASES[key] || key;
}

export function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function recordsFromCsv(text: string) {
  const rows = csvRows(text);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one income row.");
  const headers = rows[0].map(canonicalHeader);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function pick(record: Record<string, string>, ...keys: string[]) {
  return keys.map((key) => record[key]).find((value) => value != null && value.trim() !== "")?.trim() || "";
}

function cleanAmount(value: string) {
  const text = value.trim();
  if (!text) return "";
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  const cleaned = text.replace(/[,$\s]/g, "").replace(/[()]/g, "");
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return "";
  if (negative || amount < 0) throw new Error("Negative statement rows are not supported in Rights + Money v1.");
  return amount.toFixed(4).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function cleanCurrency(value: string) {
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function isoDate(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, a, b, year] = slash;
    const first = Number(a);
    const second = Number(b);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const month = text.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (month) {
    const date = new Date(`${month[1]} 1, ${month[2]} UTC`);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const ym = text.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function monthEnd(start: string) {
  if (!/^\d{4}-\d{2}-01$/.test(start)) return "";
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function statementReference(parts: Array<string | undefined>) {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("|")
    .slice(0, 240);
}

export function normalisedCsvEntries(text: string): IncomeImportEntry[] {
  return recordsFromCsv(text).map((record) => ({
    sourceCategory: pick(record, "source_category", "source"),
    providerName: pick(record, "provider_name", "provider", "service", "payer"),
    netAmount: cleanAmount(pick(record, "net_amount", "net", "amount")),
    grossAmount: cleanAmount(pick(record, "gross_amount", "gross")),
    feesAmount: cleanAmount(pick(record, "fees_amount", "fees")),
    currency: cleanCurrency(pick(record, "currency") || "USD"),
    status: pick(record, "status") || "received",
    externalReference: pick(record, "external_reference", "reference", "transaction_id"),
    periodStart: isoDate(pick(record, "period_start")),
    periodEnd: isoDate(pick(record, "period_end")),
    occurredAt: isoDate(pick(record, "occurred_at", "date")),
    territory: pick(record, "territory", "country"),
    statementName: pick(record, "statement_name", "statement"),
  }));
}

export function amuseRoyaltyCsvEntries(text: string, statementName = "Amuse royalty statement"): IncomeImportEntry[] {
  return recordsFromCsv(text).map((record, index) => {
    const periodStart = isoDate(pick(record, "period_start", "period", "occurred_at")) || new Date().toISOString().slice(0, 10);
    const periodEnd = isoDate(pick(record, "period_end")) || monthEnd(periodStart);
    const store = pick(record, "store");
    const territory = pick(record, "territory");
    const track = pick(record, "track_title");
    const release = pick(record, "release_title");
    const isrc = pick(record, "isrc");
    const upc = pick(record, "upc");
    const netAmount = cleanAmount(pick(record, "net_amount", "royalties", "amount"));
    if (!netAmount) throw new Error(`Amuse row ${index + 2} needs a royalty amount.`);

    return {
      sourceCategory: "streaming_master",
      providerName: "Amuse",
      netAmount,
      grossAmount: cleanAmount(pick(record, "gross_amount")) || netAmount,
      feesAmount: cleanAmount(pick(record, "fees_amount")) || "0",
      currency: cleanCurrency(pick(record, "currency") || "USD"),
      status: pick(record, "status") || "reported",
      externalReference: pick(record, "external_reference") || statementReference(["amuse", periodStart, periodEnd, store, territory, isrc, upc, track, release, netAmount]),
      periodStart,
      periodEnd,
      occurredAt: periodEnd || periodStart,
      territory,
      statementName,
    };
  });
}

export function incomeEntriesFromCsv(text: string, format: IncomeCsvFormat, statementName?: string) {
  return format === "amuse" ? amuseRoyaltyCsvEntries(text, statementName) : normalisedCsvEntries(text);
}
