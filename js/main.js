import { supabase, AUTH_STORAGE_KEY } from './supabase-client.js';
import * as auth from './auth.js';
import * as account from './account.js';
import * as authUI from './auth-ui.js';
import * as players from './players.js';
import * as playerState from './player-state.js';
import * as onboarding from './onboarding.js';
import * as playerUI from './player-ui.js';
import * as playerEdit from './player-edit.js';
import * as matches from './matches.js';
import * as matchesCache from './matches-cache.js';
import * as opponents from './opponents.js';
import * as opponentsCache from './opponents-cache.js';

window.supabase = supabase;
window.auth = auth;
window.account = account;
window.players = players;
window.playerState = playerState;
window.playerUI = playerUI;
window.playerEdit = playerEdit;

function clearLocalState() {
  lastUid = null;
  playerState.clearCurrentPlayer();
  playerUI.clearCache();
  matchesCache.clearAll();
  opponentsCache.clearAll();
}

async function performLogout() {
  console.log('[logout] clearing local state');
  clearLocalState();
  // Supabase の localStorage キーを直接削除（signOut のハング対策）
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
  authUI.showAuthScreen();
  // バックグラウンドで Supabase にも通知
  auth.signOut().catch(e => console.error('[logout] signOut failed:', e));
}

window.performLogout = performLogout;

function hideSplash() {
  const el = document.getElementById('splash');
  if (el) el.style.display = 'none';
}

function showHomeWithCachedData() {
  hideSplash();
  authUI.hideAuthScreen();
  if (typeof window.renderMatches === 'function') window.renderMatches();
  if (typeof window.showScreen === 'function') window.showScreen('home');
  // 選手切替UIもキャッシュから即時描画
  playerUI.rerender();
}

async function routeAfterLogin(user = null) {
  console.log('[routeAfterLogin] start, user:', user?.id?.slice(0,8) || 'null');
  showHomeWithCachedData();

  try {
    await account.getOrCreateAccount(user);
    console.log('[routeAfterLogin] account ok');
  } catch (e) {
    console.error('Failed to get account:', e);
  }

  let playerList;
  try {
    playerList = await players.listPlayers();
    console.log('[routeAfterLogin] listPlayers ok, count:', playerList.length);
    playerUI.setPlayers(playerList);
  } catch (e) {
    console.error('Failed to list players (will retry on next auth event):', e);
    return;
  }

  if (playerList.length === 0) {
    onboarding.showOnboardingScreen();
    return;
  }

  const currentId = playerState.getCurrentPlayerId();
  const validCurrent = playerList.find(p => p.id === currentId);
  if (!validCurrent) {
    playerState.setCurrentPlayerId(playerList[0].id);
  }

  playerUI.rerender();

  // matches と opponents もバックグラウンドでリフレッシュ
  matchesService.refreshCurrent(() => {
    if (typeof window.renderMatches === 'function') window.renderMatches();
  });
  opponentsService.refresh();

  console.log('[routeAfterLogin] done');
}

function getSessionWithTimeout(ms = 3000) {
  return Promise.race([
    auth.getSession(),
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function hasStoredSession() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!data?.access_token) return false;
    if (data.expires_at && data.expires_at * 1000 < Date.now()) return false;
    return true;
  } catch { return false; }
}

async function init() {
  // localStorage に有効なセッションがあれば即座にホームを表示（最終確定は onAuthStateChange の INITIAL_SESSION で行う）
  if (hasStoredSession()) {
    showHomeWithCachedData();
  } else {
    // 念のため getSession も試す（外部リダイレクト戻り直後など、storage 反映前のケース）
    const session = await getSessionWithTimeout();
    if (session) {
      await routeAfterLogin();
    } else {
      authUI.showAuthScreen();
    }
  }
}

let lastUid = null;

const matchesService = {
  getCurrent() {
    const pid = playerState.getCurrentPlayerId();
    return matchesCache.load(pid);
  },
  async refreshCurrent(onUpdate) {
    const pid = playerState.getCurrentPlayerId();
    if (!pid) return;
    try {
      const rows = await matches.listByPlayer(pid);
      const list = rows.map(matches.rowToMatch);
      matchesCache.save(pid, list);
      onUpdate?.(list);
    } catch (e) {
      console.error('Failed to refresh matches:', e);
    }
  },
  async create(matchData) {
    const pid = playerState.getCurrentPlayerId();
    if (!pid) throw new Error('No current player');
    const row = await matches.createMatch(pid, matchData);
    const m = matches.rowToMatch(row);
    const list = matchesCache.load(pid);
    list.unshift(m);
    matchesCache.save(pid, list);
    return m;
  },
  async update(id, matchData) {
    const pid = playerState.getCurrentPlayerId();
    if (!pid) throw new Error('No current player');
    const row = await matches.updateMatch(id, matchData);
    const m = matches.rowToMatch(row);
    const list = matchesCache.load(pid);
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx] = m;
    matchesCache.save(pid, list);
    return m;
  },
  async delete(id) {
    const pid = playerState.getCurrentPlayerId();
    if (!pid) throw new Error('No current player');
    await matches.deleteMatch(id);
    const list = matchesCache.load(pid).filter(x => x.id !== id);
    matchesCache.save(pid, list);
  },
};

const opponentsService = {
  getAll() {
    return opponentsCache.load();
  },
  async refresh(onUpdate) {
    const accountId = lastUid;
    if (!accountId) return;
    try {
      const rows = await opponents.listAll(accountId);
      const list = rows.map(opponents.rowToOpponent);
      opponentsCache.save(list);
      onUpdate?.(list);
    } catch (e) {
      console.error('Failed to refresh opponents:', e);
    }
  },
  async create(opp) {
    const accountId = lastUid;
    if (!accountId) throw new Error('Not authenticated');
    const row = await opponents.createOpponent(accountId, opp);
    const o = opponents.rowToOpponent(row);
    const list = opponentsCache.load();
    list.unshift(o);
    opponentsCache.save(list);
    return o;
  },
  async update(id, opp) {
    const row = await opponents.updateOpponent(id, opp);
    const o = opponents.rowToOpponent(row);
    const list = opponentsCache.load();
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx] = o;
    opponentsCache.save(list);
    return o;
  },
  async delete(id) {
    await opponents.deleteOpponent(id);
    const list = opponentsCache.load().filter(x => x.id !== id);
    opponentsCache.save(list);
  },
};

window.matchesService = matchesService;
window.opponentsService = opponentsService;

// 選手切替時に matches を再描画
playerState.onCurrentPlayerChange(() => {
  matchesService.refreshCurrent(() => {
    if (typeof window.renderMatches === 'function') window.renderMatches();
  });
});

auth.onAuthStateChange(async (event, session) => {
  console.log('[auth event]', event, session ? `user:${session.user.id.slice(0,8)}` : 'null');
  // INITIAL_SESSION = 起動時のセッション復元、SIGNED_IN = 新規ログイン
  if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session) {
    if (session.user.id === lastUid) return;
    lastUid = session.user.id;
    await routeAfterLogin(session.user);
  }
  if (event === 'SIGNED_OUT') {
    clearLocalState();
    authUI.showAuthScreen();
  }
});

init();
