import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'level' });

export function readJSON<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (raw == null) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  storage.set(key, JSON.stringify(value));
}
