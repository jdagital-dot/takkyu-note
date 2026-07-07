import * as players from './players.js';
import * as playerState from './player-state.js';
import { esc } from './escape.js';

const CACHE_KEY = 'pingpong_players_cache';

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveCache(list) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch {}
}

let playerListCache = loadCache();
let dropdownOpen = false;

export async function refreshSwitcher() {
  // まずキャッシュから即描画
  renderSwitcher();
  // バックグラウンドで Supabase から最新を取得
  try {
    const list = await players.listPlayers();
    setPlayers(list);
  } catch (e) {
    console.error('Failed to refresh players (keeping cache):', e);
  }
}

export function setPlayers(list) {
  playerListCache = list;
  saveCache(list);
  renderSwitcher();
}

export function rerender() {
  renderSwitcher();
}

export function getPlayers() {
  return playerListCache;
}

export function clearCache() {
  playerListCache = [];
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

function renderSwitcher() {
  const mount = document.getElementById('player-switcher-mount');
  if (!mount) return;

  if (playerListCache.length === 0) {
    // キャッシュが空のときは既存DOMを保持してスキップ（一時的な fetch 失敗で消えないように）
    return;
  }

  const currentId = playerState.getCurrentPlayerId();
  const current = playerListCache.find(p => p.id === currentId) || playerListCache[0];
  const initial = (current.name || '?')[0];

  mount.innerHTML = `
    <button onclick="event.stopPropagation(); window.playerUI.toggleDropdown()" aria-label="選手を切り替え" style="background:#f5f5f5; border:none; border-radius:20px; padding:6px 10px; display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit;">
      <span style="width:22px; height:22px; background:linear-gradient(135deg,#1a1a2e,#e53935); border-radius:50%; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0;">${esc(initial)}</span>
      <span style="max-width:60px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(current.name)}</span>
      <span style="color:#aaa; font-size:9px;">▼</span>
    </button>
    <div id="player-dropdown" style="display:${dropdownOpen ? 'block' : 'none'}; position:absolute; right:0; top:48px; background:#fff; border:1px solid #eee; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.1); z-index:50; min-width:220px; overflow:hidden;">
      ${playerListCache.map(p => `
        <div style="display:flex; align-items:stretch; border-bottom:1px solid #f5f5f5; background:${p.id === current.id ? '#fff5f5' : '#fff'};">
          <button onclick="window.playerUI.selectPlayer('${p.id}')" style="flex:1; display:flex; align-items:center; gap:10px; padding:12px 14px; background:none; border:none; text-align:left; font-size:13px; cursor:pointer; font-family:inherit;">
            <span style="width:22px; height:22px; background:linear-gradient(135deg,#1a1a2e,#e53935); border-radius:50%; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0;">${esc((p.name || '?')[0])}</span>
            <span style="flex:1;">${esc(p.name)}</span>
            ${p.id === current.id ? '<span style="color:#e53935; font-size:11px;">●</span>' : ''}
          </button>
          <button onclick="window.playerUI.editPlayer('${p.id}')" aria-label="${esc(p.name)}を編集" style="padding:0 14px; background:none; border:none; color:#888; cursor:pointer; font-size:14px;">✎</button>
        </div>
      `).join('')}
      <button onclick="window.playerUI.openAddPlayer()" style="display:flex; align-items:center; gap:10px; width:100%; padding:12px 14px; background:#fafafa; border:none; text-align:left; font-size:13px; cursor:pointer; color:#e53935; font-weight:600; font-family:inherit;">
        ＋ 選手を追加
      </button>
    </div>
  `;
}

export function toggleDropdown() {
  dropdownOpen = !dropdownOpen;
  renderSwitcher();
}

export function selectPlayer(id) {
  playerState.setCurrentPlayerId(id);
  dropdownOpen = false;
  renderSwitcher();
  if (typeof window.renderMatches === 'function') window.renderMatches();
}

export function openAddPlayer() {
  dropdownOpen = false;
  renderSwitcher();
  if (window.playerEdit) window.playerEdit.openAdd();
}

export function editPlayer(id) {
  const player = playerListCache.find(p => p.id === id);
  if (!player) return;
  dropdownOpen = false;
  renderSwitcher();
  if (window.playerEdit) window.playerEdit.openEdit(player);
}

document.addEventListener('click', (e) => {
  if (!dropdownOpen) return;
  const mount = document.getElementById('player-switcher-mount');
  if (mount && !mount.contains(e.target)) {
    dropdownOpen = false;
    renderSwitcher();
  }
});

window.playerUI = { toggleDropdown, selectPlayer, openAddPlayer, editPlayer, refreshSwitcher, rerender, getPlayers, setPlayers, clearCache };
