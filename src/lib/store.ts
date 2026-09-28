import { google, sheets_v4 } from 'googleapis';
import { SCHEMA, ID_PREFIX, Row } from './schema';

export interface Store {
  init(): Promise<{ spreadsheetId: string; url: string }>;
  list(sheet: string): Promise<Row[]>;
  get(sheet: string, id: string): Promise<Row | undefined>;
  insert(sheet: string, row: Partial<Row>): Promise<Row>;
  update(sheet: string, id: string, patch: Partial<Row>): Promise<Row>;
  remove(sheet: string, id: string): Promise<void>;
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

export class DemoStore implements Store {
  private d: Record<string, Row[]> = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, []]));
  async init() { return { spreadsheetId: 'DEMO', url: 'about:blank (DEMO_MODE, in-memory data)' }; }
  async list(s: string) { return [...this.d[s]]; }
  async get(s: string, id: string) { return this.d[s].find(r => r.id === id); }
  async insert(s: string, row: Partial<Row>) {
    const r = full(s, { ...row, id: row.id || nextId(s, this.d[s]) });
    this.d[s].push(r); return r;
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
  private cache = new Map<string, { at: number; rows: Row[] }>();
  private ttl = 15_000;
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
    const data = names.flatMap((n, i) => heads.data.valueRanges?.[i]?.values?.[0]?.length ? [] :
      [{ range: `${n}!A1`, values: [SCHEMA[n]] }]);
    if (data.length) await retry(() => this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.id, requestBody: { valueInputOption: 'RAW', data } }));
    return { spreadsheetId: this.id, url: this.url() };
  }

  async list(s: string) {
    const c = this.cache.get(s);
    if (c && Date.now() - c.at < this.ttl) return [...c.rows];
    const r = await retry(() => this.api.spreadsheets.values.get({
      spreadsheetId: this.id, range: `${s}!A2:${col(SCHEMA[s].length - 1)}` }));
    const rows = (r.data.values ?? []).map(v => Object.fromEntries(SCHEMA[s].map((h, i) => [h, String(v[i] ?? '')])) as Row)
      .filter(r => r.id);
    this.cache.set(s, { at: Date.now(), rows });
    return [...rows];
  }
  async get(s: string, id: string) { return (await this.list(s)).find(r => r.id === id); }
  async insert(s: string, row: Partial<Row>) {
    this.cache.delete(s); // fresh read so ID generation is accurate
    const r = full(s, { ...row, id: row.id || nextId(s, await this.list(s)) });
    await retry(() => this.api.spreadsheets.values.append({
      spreadsheetId: this.id, range: `${s}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [SCHEMA[s].map(h => r[h])] } }));
    this.cache.delete(s); return r;
  }
  async update(s: string, id: string, patch: Partial<Row>) {
    const ids = await retry(() => this.api.spreadsheets.values.get({ spreadsheetId: this.id, range: `${s}!A2:A` }));
    const idx = (ids.data.values ?? []).findIndex(v => v[0] === id);
    if (idx < 0) throw Object.assign(new Error('Not found'), { status: 404 });
    const cur = (await this.get(s, id))!;
    const r = full(s, { ...cur, ...patch, id });
    await retry(() => this.api.spreadsheets.values.update({
      spreadsheetId: this.id, range: `${s}!A${idx + 2}`, valueInputOption: 'RAW', requestBody: { values: [SCHEMA[s].map(h => r[h])] } }));
    this.cache.delete(s); return r;
  }
  async remove(s: string, id: string) {
    const meta = await retry(() => this.api.spreadsheets.get({ spreadsheetId: this.id, fields: 'sheets.properties' }));
    const sheetId = meta.data.sheets?.find(x => x.properties?.title === s)?.properties?.sheetId;
    const ids = await retry(() => this.api.spreadsheets.values.get({ spreadsheetId: this.id, range: `${s}!A2:A` }));
    const idx = (ids.data.values ?? []).findIndex(v => v[0] === id);
    if (idx < 0 || sheetId == null) return;
    await retry(() => this.api.spreadsheets.batchUpdate({ spreadsheetId: this.id, requestBody: { requests: [
      { deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }] } }));
    this.cache.delete(s);
  }
}
export const createStore = (): Store => {
  const noCreds = !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY;
  const demo = process.env.DEMO_MODE === 'true' || (noCreds && process.env.NODE_ENV !== 'production');
  if (demo) console.warn('[store] Running in DEMO mode with in-memory dummy data (no Google Sheets).');
  return demo ? new DemoStore() : new SheetsStore();
};
