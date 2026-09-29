import { google, sheets_v4 } from 'googleapis';
import { SCHEMA, ID_PREFIX, Row } from './schema';
import { kv, singleflight } from './cache';

export interface Store {
  init(): Promise<{ spreadsheetId: string; url: string }>;
  list(sheet: string): Promise<Row[]>;
  get(sheet: string, id: string): Promise<Row | undefined>;
  insert(sheet: string, row: Partial<Row>): Promise<Row>;
  /** Insert many rows with ONE API call. */
  insertMany(sheet: string, rows: Partial<Row>[]): Promise<Row[]>;
  update(sheet: string, id: string, patch: Partial<Row>): Promise<Row>;
  remove(sheet: string, id: string): Promise<void>;
  /** Delete rows across several sheets in a fixed 3 API calls, e.g. { Invoices: [id], InvoiceItems: [...] }. */
  removeMany(targets: Record<string, string[]>): Promise<void>;
}

const pad = (n: number, w = 6) => String(n).padStart(w, '0');
function nextId(sheet: string, rows: Row[]): string {
  const p = ID_PREFIX[sheet] ?? sheet.toUpperCase().slice(0, 4);
  const yr = sheet === 'Invoices' ? `${new Date().getFullYear()}-` : '';
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.id.split('-').pop() || '0', 10) || 0), 0);
  return `${p}-${yr}${pad(max + 1)}`;
}
const full = (sheet: string, r: Partial<Row>): Row =>
  Object.fromEntries(SCHEMA[sheet].map(h => [h, r[h] ?? ''])) as Row;
/** Rows that have a `number` column (Invoices, Tickets) get number = id on insert, so no follow-up update call is needed. */
const withNumber = (sheet: string, r: Row): Row => (SCHEMA[sheet].includes('number') && !r.number ? { ...r, number: r.id } : r);
function buildRows(sheet: string, existing: Row[], rows: Partial<Row>[]): Row[] {
  const all = [...existing], out: Row[] = [];
  for (const r of rows) { const row = withNumber(sheet, full(sheet, { ...r, id: r.id || nextId(sheet, all) })); all.push(row); out.push(row); }
  return out;
}

/** Sheets whose ids are never shown to people get a unique time-based id, so inserting needs NO read of the sheet (1 API call instead of 2). */
const SEQ_FREE = new Set(['AuditLog', 'TicketActivities', 'TicketMessages', 'InvoiceItems', 'Notifications']);
const uid = (sheet: string) => `${ID_PREFIX[sheet] ?? sheet.toUpperCase().slice(0, 4)}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export class DemoStore implements Store {
  private d: Record<string, Row[]> = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, []]));
  async init() { return { spreadsheetId: 'DEMO', url: 'about:blank (DEMO_MODE, in-memory data)' }; }
  async list(s: string) { return [...this.d[s]]; }
  async get(s: string, id: string) { return this.d[s].find(r => r.id === id); }
  async insert(s: string, row: Partial<Row>) {
    const [r] = buildRows(s, this.d[s], [row]);
    this.d[s].push(r); return r;
  }
  async insertMany(s: string, rows: Partial<Row>[]) {
    const out = buildRows(s, this.d[s], rows); this.d[s].push(...out); return out;
  }
  async removeMany(t: Record<string, string[]>) {
    for (const [s, ids] of Object.entries(t)) this.d[s] = this.d[s].filter(r => !ids.includes(r.id));
  }
  async update(s: string, id: string, patch: Partial<Row>) {
    const i = this.d[s].findIndex(r => r.id === id);
    if (i < 0) throw Object.assign(new Error('Not found'), { status: 404 });
    this.d[s][i] = full(s, { ...this.d[s][i], ...patch, id }); return this.d[s][i];
  }
  async remove(s: string, id: string) { this.d[s] = this.d[s].filter(r => r.id !== id); }
}

async function retry<T>(fn: () => Promise<T>, max = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e: any) {
      const c = Number(e?.code ?? e?.response?.status);
      if (i >= max || ![429, 500, 502, 503, 504].includes(c)) throw e;
      await new Promise(r => setTimeout(r, 2 ** i * 500 + Math.random() * 250));
    }
  }
}
const col = (n: number) => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

export class SheetsStore implements Store {
  private api: sheets_v4.Sheets;
  private id = process.env.GOOGLE_SPREADSHEET_ID || '';
  /** Bumped on every local write so a read that started before the write never re-caches stale rows. */
  private epoch: Record<string, number> = {};
  private ttl = Number(process.env.CACHE_TTL_SECONDS) || (process.env.REDIS_URL ? 60 : 15);
  constructor() {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
    });
    this.api = google.sheets({ version: 'v4', auth });
  }
  private url() { return `https://docs.google.com/spreadsheets/d/${this.id}`; }

  /** Idempotent: creates spreadsheet, missing tabs and empty headers only. */
  async init() {
    const names = Object.keys(SCHEMA);
    if (!this.id) {
      const res = await retry(() => this.api.spreadsheets.create({
        requestBody: { properties: { title: 'Velvotix Portal Database' }, sheets: names.map(title => ({ properties: { title } })) },
      }));
      this.id = res.data.spreadsheetId!;
      console.log(`Created spreadsheet. Set GOOGLE_SPREADSHEET_ID=${this.id}`);
    } else {
      const meta = await retry(() => this.api.spreadsheets.get({ spreadsheetId: this.id, fields: 'sheets.properties.title' }));
      const have = new Set(meta.data.sheets?.map(s => s.properties?.title));
      const missing = names.filter(n => !have.has(n));
      if (missing.length) await retry(() => this.api.spreadsheets.batchUpdate({
        spreadsheetId: this.id, requestBody: { requests: missing.map(title => ({ addSheet: { properties: { title } } })) } }));
    }
    const heads = await retry(() => this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.id, ranges: names.map(n => `${n}!A1:${col(SCHEMA[n].length - 1)}1`) }));
    // Write headers when empty, or when the sheet has an older header row that is a prefix of the current schema
    // (i.e. new columns were appended in code). This migrates existing spreadsheets safely.
    const data = names.flatMap((n, i) => {
      const cur = (heads.data.valueRanges?.[i]?.values?.[0] ?? []).map(String);
      const stale = cur.length === 0 || (cur.length < SCHEMA[n].length && cur.every((h, k) => h === SCHEMA[n][k]));
      return stale ? [{ range: `${n}!A1`, values: [SCHEMA[n]] }] : [];
    });
    if (data.length) await retry(() => this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.id, requestBody: { valueInputOption: 'RAW', data } }));
    return { spreadsheetId: this.id, url: this.url() };
  }

  private key(s: string) { return `${this.id}:sheet:${s}`; }
  private async invalidate(s: string) { this.epoch[s] = (this.epoch[s] || 0) + 1; await kv.del(this.key(s)); }
  private async readSheet(s: string): Promise<Row[]> {
    const r = await retry(() => this.api.spreadsheets.values.get({
      spreadsheetId: this.id, range: `${s}!A2:${col(SCHEMA[s].length - 1)}` }));
    return (r.data.values ?? []).map(v => Object.fromEntries(SCHEMA[s].map((h, i) => [h, String(v[i] ?? '')])) as Row).filter(r => r.id);
  }
  /** Redis (or memory) first; one shared Google API read on a miss. Any write through this store invalidates the entry. */
  async list(s: string) {
    const key = this.key(s);
    const hit = await kv.getJSON<Row[]>(key);
    if (hit) return hit;
    const rows = await singleflight(key, async () => {
      const e = this.epoch[s] || 0;
      const fresh = await this.readSheet(s);
      if ((this.epoch[s] || 0) === e) await kv.setJSON(key, fresh, this.ttl);
      return fresh;
    });
    return [...rows];
  }
  async get(s: string, id: string) { return (await this.list(s)).find(r => r.id === id); }
  async insert(s: string, row: Partial<Row>) { return (await this.insertMany(s, [row]))[0]; }
  async insertMany(s: string, rows: Partial<Row>[]) {
    if (!rows.length) return [];
    // Numbered sheets need a fresh read so ids are accurate; id-free sheets skip the read entirely.
    const out = SEQ_FREE.has(s)
      ? buildRows(s, [], rows.map(r => ({ ...r, id: r.id || uid(s) })))
      : buildRows(s, await this.readSheet(s), rows);
    await retry(() => this.api.spreadsheets.values.append({
      spreadsheetId: this.id, range: `${s}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: out.map(r => SCHEMA[s].map(h => r[h])) } }));
    await this.invalidate(s); return out;
  }
  async update(s: string, id: string, patch: Partial<Row>) {
    // One read of the whole sheet body gives both the row position and the current values (2 API calls per update, not 3).
    const all = await retry(() => this.api.spreadsheets.values.get({ spreadsheetId: this.id, range: `${s}!A2:${col(SCHEMA[s].length - 1)}` }));
    const body = all.data.values ?? [], idx = body.findIndex(v => v[0] === id);
    if (idx < 0) throw Object.assign(new Error('Not found'), { status: 404 });
    const cur = Object.fromEntries(SCHEMA[s].map((h, i) => [h, String(body[idx][i] ?? '')])) as Row;
    const r = full(s, { ...cur, ...patch, id });
    await retry(() => this.api.spreadsheets.values.update({
      spreadsheetId: this.id, range: `${s}!A${idx + 2}`, valueInputOption: 'RAW', requestBody: { values: [SCHEMA[s].map(h => r[h])] } }));
    await this.invalidate(s); return r;
  }
  async remove(s: string, id: string) { return this.removeMany({ [s]: [id] }); }
  async removeMany(targets: Record<string, string[]>) {
    const names = Object.keys(targets).filter(n => targets[n].length);
    if (!names.length) return;
    const [meta, idCols] = await Promise.all([
      retry(() => this.api.spreadsheets.get({ spreadsheetId: this.id, fields: 'sheets.properties' })),
      retry(() => this.api.spreadsheets.values.batchGet({ spreadsheetId: this.id, ranges: names.map(n => `${n}!A2:A`) })),
    ]);
    const requests = names.flatMap((n, k) => {
      const sheetId = meta.data.sheets?.find(x => x.properties?.title === n)?.properties?.sheetId;
      if (sheetId == null) return [];
      const idList = (idCols.data.valueRanges?.[k]?.values ?? []).map(v => v[0]);
      // delete from the bottom up so earlier row indexes stay valid
      return targets[n].map(id => idList.indexOf(id)).filter(i => i >= 0).sort((a, b) => b - a)
        .map(i => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 } } }));
    });
    if (requests.length) await retry(() => this.api.spreadsheets.batchUpdate({ spreadsheetId: this.id, requestBody: { requests } }));
    await Promise.all(names.map(n => this.invalidate(n)));
  }
}
export const createStore = (): Store => {
  const noCreds = !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY;
  const demo = process.env.DEMO_MODE === 'true' || (noCreds && process.env.NODE_ENV !== 'production');
  if (demo) console.warn('[store] Running in DEMO mode with in-memory dummy data (no Google Sheets).');
  return demo ? new DemoStore() : new SheetsStore();
};
