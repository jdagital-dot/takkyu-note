const KEY_PREFIX = 'pingpong_matches_cache_';

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

export function save(playerId, matches) {
  if (!playerId) return;
  try {
    localStorage.setItem(key(playerId), JSON.stringify(matches));
  } catch (e) {
    console.error('Failed to cache matches:', e);
  }
}

export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(KEY_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}
