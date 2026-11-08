// v2: 項目＋出来栄え（items）の形。最初の版のキャッシュ（v1）は読まずに消す
const KEY_PREFIX = 'pingpong_practice_v2_';
const OLD_PREFIXES = ['pingpong_practice_cache_'];

function key(playerId) {
  return `${KEY_PREFIX}${playerId}`;
}

export function load(playerId) {
  if (!playerId) return [];
  try {
    const raw = localStorage.getItem(key(playerId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function save(playerId, notes) {
  if (!playerId) return;
  try {
    localStorage.setItem(key(playerId), JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to cache practice notes:', e);
  }
}

export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(KEY_PREFIX) || OLD_PREFIXES.some(p => k.startsWith(p)))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}

// 起動時に最初の版のキャッシュを片付ける
try {
  Object.keys(localStorage)
    .filter(k => OLD_PREFIXES.some(p => k.startsWith(p)))
    .forEach(k => localStorage.removeItem(k));
} catch {}
