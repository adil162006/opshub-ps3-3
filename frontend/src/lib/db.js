import { create } from 'zustand';
import { buildSeed } from './seed';

export const DB_KEY = 'opshub.db.v1';
function load() {
  try { const raw = globalThis.localStorage?.getItem(DB_KEY); if (raw) return JSON.parse(raw); } catch { /* fall through */ }
  return buildSeed();
}
export const useDB = create(() => load());
useDB.subscribe((s) => { try { globalThis.localStorage?.setItem(DB_KEY, JSON.stringify(s)); } catch { /* quota */ } });
export const dbGet = () => useDB.getState();
export const dbCommit = (next) => useDB.setState(next, true);
export const resetDB = () => dbCommit(buildSeed());
