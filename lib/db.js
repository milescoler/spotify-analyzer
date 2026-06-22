// Tiny JSON-file data store. No external dependencies — the whole database is
// a single object persisted to data/data.json. Seeded on first run.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSeed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

let db = null;
let saveTimer = null;

export function load() {
  if (db) return db;
  try {
    if (fs.existsSync(DATA_FILE)) {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return db;
    }
  } catch (err) {
    console.error('Could not read data file, reseeding:', err.message);
  }
  db = buildSeed();
  persist();
  return db;
}

export function reset() {
  db = buildSeed();
  persist();
  return db;
}

// Debounced write so rapid practice submissions don't thrash the disk.
export function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(persist, 150);
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// Convenience accessors.
export const get = () => load();
export const user = (uid) => load().users.find((u) => u.id === uid);
export const usersByRole = (role) => load().users.filter((u) => u.role === role);
export const deck = (did) => load().decks.find((d) => d.id === did);
export const subject = (sid) => load().subjects.find((s) => s.id === sid);
export const term = (tid) => {
  for (const d of load().decks) {
    const t = d.terms.find((x) => x.id === tid);
    if (t) return { ...t, deck: d };
  }
  return null;
};
export const masteryKey = (sid, tid) => `${sid}:${tid}`;
