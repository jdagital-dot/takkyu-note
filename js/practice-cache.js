const KEY_PREFIX = 'pingpong_practice_cache_';

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
      .filter(k => k.startsWith(KEY_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}
