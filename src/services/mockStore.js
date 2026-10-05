// MOCK persistence used by api.js while there is no server.
// Loads data/seed/*.json once, then keeps the whole database in localStorage.
// The real API replaces this file (see docs/HANDOFF_CODEX.md); no screen imports it directly.

export const TABLES = [
  'organizations', 'projects', 'profile_versions', 'form_imports', 'users',
  'institutions', 'contacts', 'relationships', 'interactions', 'settings',
  'consents', 'email_outbox',
];

const STORAGE_KEY = 'cp.v2.db';
const SEED_VERSION = 4; // bump to discard old local data after a seed change

let db = null;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SEED_VERSION, tables: db }));
  } catch (err) {
    console.warn('[mockStore] could not save to localStorage', err);
  }
}

async function loadSeed() {
  const tables = {};
  await Promise.all(TABLES.map(async (name) => {
    const res = await fetch('data/seed/' + name + '.json');
    tables[name] = res.ok ? await res.json() : [];
  }));
  return tables;
}

export async function init() {
  if (db) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.version === SEED_VERSION) db = saved.tables;
  } catch (err) { /* corrupted or blocked storage: fall back to the seed */ }
  if (!db) {
    db = await loadSeed();
    persist();
  }
  TABLES.forEach((t) => { if (!db[t]) db[t] = []; });
}

export async function reset() {
  db = await loadSeed();
  persist();
}

export function all(table) {
  return clone(db[table]);
}

export function find(table, predicate) {
  return clone(db[table].filter(predicate));
}

export function get(table, id) {
  return clone(db[table].find((row) => row.id === id));
}

let counter = 0;
export function newId(prefix) {
  counter += 1;
  return prefix + '-' + Date.now().toString(36) + counter.toString(36);
}

export function insert(table, row) {
  const stored = Object.assign({ id: newId(table.slice(0, 3)) }, clone(row));
  db[table].push(stored);
  persist();
  return clone(stored);
}

export function update(table, id, patch) {
  const row = db[table].find((r) => r.id === id);
  if (!row) throw new Error('[mockStore] ' + table + '/' + id + ' not found');
  Object.assign(row, clone(patch));
  persist();
  return clone(row);
}

export function remove(table, id) {
  db[table] = db[table].filter((r) => r.id !== id);
  persist();
}
