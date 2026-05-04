const STORAGE_KEY = 'pingpong_current_player_id';

const listeners = new Set();

export function getCurrentPlayerId() {
  return localStorage.getItem(STORAGE_KEY);
}

export function setCurrentPlayerId(id) {
  if (id) {
    localStorage.setItem(STORAGE_KEY, id);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach(fn => {
    try { fn(id); } catch (e) { console.error(e); }
  });
}

export function onCurrentPlayerChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function clearCurrentPlayer() {
  setCurrentPlayerId(null);
}
