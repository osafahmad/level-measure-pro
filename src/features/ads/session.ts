import { createMMKV } from 'react-native-mmkv';

/** Ads bookkeeping only; kept apart from the level store so ads never touch readings. */
const storage = createMMKV({ id: 'ads' });

const RELOAD_AT = 'reloadAt';
const SESSIONS = 'sessions';
const APP_OPEN_SHOWN_AT = 'appOpenShownAt';
/** A restart marked this recently is a JS reload (react-native-restart), not a cold start. */
const RELOAD_WINDOW_MS = 30_000;

export type LaunchKind = 'cold' | 'reload';

function readNumber(key: string): number | null {
  const raw = storage.getString(key);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function writeNumber(key: string, value: number) {
  storage.set(key, String(value));
}

/** Call right before RNRestart.restart() so the reloaded bundle does not count as a launch. */
export function markJsReload() {
  try {
    writeNumber(RELOAD_AT, Date.now());
  } catch {}
}

let launch: { kind: LaunchKind; at: number; sessions: number } | null = null;

/** Resolved once per JS runtime: cold starts bump the session counter, reloads do not. */
export function launchInfo() {
  if (launch) return launch;
  const now = Date.now();
  let kind: LaunchKind = 'cold';
  let sessions = 1;
  try {
    const reloadAt = readNumber(RELOAD_AT);
    storage.remove(RELOAD_AT);
    if (reloadAt != null && now - reloadAt >= 0 && now - reloadAt < RELOAD_WINDOW_MS) kind = 'reload';
    sessions = (readNumber(SESSIONS) ?? 0) + (kind === 'cold' ? 1 : 0);
    writeNumber(SESSIONS, Math.max(1, sessions));
  } catch {}
  launch = { kind, at: now, sessions: Math.max(1, sessions) };
  return launch;
}

export function appOpenShownAt(): number | null {
  try {
    return readNumber(APP_OPEN_SHOWN_AT);
  } catch {
    return null;
  }
}

export function setAppOpenShownAt(at: number) {
  try {
    writeNumber(APP_OPEN_SHOWN_AT, at);
  } catch {}
}

/** Tests only. `clearStorage: false` simulates the next launch of the same install. */
export function __resetSessionForTests(clearStorage = true) {
  launch = null;
  if (clearStorage) storage.clearAll();
}
