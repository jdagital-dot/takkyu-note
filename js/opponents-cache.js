const KEY = 'pingpong_opponents_cache';

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function save(opponents) {
  try {
    localStorage.setItem(KEY, JSON.stringify(opponents));
  } catch (e) {
    console.error('Failed to cache opponents:', e);
  }
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch {}
}
