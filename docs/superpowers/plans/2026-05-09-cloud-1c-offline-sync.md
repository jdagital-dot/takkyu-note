# Cloud Phase 1C: Offline Sync 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 圏外でも試合・アドレス帳の作成／更新／削除ができ、オンライン復帰時に自動でクラウド同期される状態にする。同期状況をユーザーが画面で確認できる。

**Architecture:**
- Phase 1D の `matchesService` / `opponentsService` を **Optimistic UI + Sync Queue** ベースに改造
- 書き込みは即座にローカルキャッシュへ反映 → UI 即時更新 → バックグラウンドで Supabase へ送信
- 失敗（オフライン／ネットワークエラー）時はローカルの sync queue に積む
- `online` イベント、起動時、明示的な再同期ボタンの3トリガーで queue を flush
- 新規作成行は temp ID（`local-<uuid>`）で扱い、サーバ確定後に remote ID へ置換
- コンフリクトは Last-Write-Wins（`updated_at` ベース、Phase 1C ではローカル側を尊重）
- IndexedDB 移行は **このプランのスコープ外**。キャッシュ層は localStorage のまま継続（容量逼迫の兆候が出たら別フェーズで実施）

**Tech Stack:** Vanilla JS ES modules、Supabase JS Client、`crypto.randomUUID`、Playwright（テスト）

**Spec:** `docs/superpowers/specs/2026-04-25-cloud-phase-1-design.md` §5

**Phase 1D 完了状態:** matches / opponents は Supabase に同期書き込み（`await` で完了を待つ）。失敗時は `alert()` で通知して操作中断。圏外では何もできない。

**スコープ:** 完了時点で「圏外で記録 → 後でオンラインに戻ると自動で同期される」「同期ステータスがヘッダーに小さく出る」「明示的に再同期できる」状態。IndexedDB への移行、リアルタイム購読（Realtime）、複数端末間のコンフリクト UI は対象外。

---

## ファイル構成

### 新規作成
- `js/sync-queue.js` — sync queue の永続化と flush ロジック
- `js/sync-status.js` — 同期ステータスの state と listener
- `js/sync-ui.js` — ヘッダーの同期インジケーター描画
- `tests/sync.spec.js` — オフライン同期の Playwright テスト

### 修正
- `js/matches.js` — temp ID 付きの create に対応（既存 row は変更なし、新たに `createMatchAt(tempId, ...)` 等を足すか、既存を拡張）
- `js/opponents.js` — 同上
- `js/main.js` — `matchesService` / `opponentsService` を Optimistic + Queue 化、起動時と `online` で flush
- `index.html` — ヘッダー右上に同期インジケーターのマウントポイント追加。`alert()` で中断していた箇所を「失敗時は queue に積んで継続」に変更

---

## Task 1: Sync Queue モジュール

**Files:**
- Create: `js/sync-queue.js`

設計：
- 1キュー = `{ id, op, resource, payload, retries, lastError, createdAt }`
- `op`: `create` | `update` | `delete`
- `resource`: `match` | `opponent`
- `payload`: 操作対象のフィールド（create は `{ tempId, ... }`、update は `{ id, ... }`）
- localStorage キー: `pingpong_sync_queue_v1`（破壊的変更時はバージョンアップ）

- [ ] **Step 1: sync-queue.js を作成**

```javascript
const KEY = 'pingpong_sync_queue_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeAll(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    console.error('[sync-queue] write failed:', e);
  }
}

export function enqueue(item) {
  const items = readAll();
  const enriched = {
    ...item,
    id: item.id || `q-${crypto.randomUUID()}`,
    retries: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
  };
  items.push(enriched);
  writeAll(items);
  return enriched;
}

export function listAll() {
  return readAll();
}

export function size() {
  return readAll().length;
}

export function remove(id) {
  writeAll(readAll().filter(x => x.id !== id));
}

export function update(id, patch) {
  const items = readAll();
  const idx = items.findIndex(x => x.id === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...patch };
    writeAll(items);
  }
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch {}
}
```

- [ ] **Step 2: 動作確認（DevTools）**

```javascript
import * as q from './sync-queue.js';
q.enqueue({ op: 'create', resource: 'match', payload: { tempId: 'local-1', date: '2026-05-09' } });
q.size(); // → 1
q.listAll(); // → [{ ... }]
```

---

## Task 2: Sync Status モジュール

**Files:**
- Create: `js/sync-status.js`

state は4種：
- `'idle'`（緑・全件同期済）
- `'syncing'`（黄・スピナー）
- `'offline'`（橙・X件未同期）
- `'error'`（赤・タップで再試行）

- [ ] **Step 1: sync-status.js を作成**

```javascript
const listeners = new Set();
let state = { kind: 'idle', pending: 0, lastError: null };

export function get() { return state; }

export function set(next) {
  state = { ...state, ...next };
  listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
}

export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
```

---

## Task 3: 同期インジケーター UI

**Files:**
- Create: `js/sync-ui.js`
- Modify: `index.html` — ヘッダーに `#sync-indicator-mount` 追加

- [ ] **Step 1: index.html のホーム画面ヘッダーに mount 追加**

既存ヘッダー（`#player-switcher-mount` の隣）に：

```html
<div id="sync-indicator-mount" style="flex-shrink:0; margin-right:6px;"></div>
```

- [ ] **Step 2: sync-ui.js を作成**

```javascript
import * as syncStatus from './sync-status.js';

const COLORS = {
  idle:    { bg:'#e8f5e9', dot:'#43a047', label:'同期済み' },
  syncing: { bg:'#fff8e1', dot:'#ffb300', label:'同期中…' },
  offline: { bg:'#fff3e0', dot:'#fb8c00', label:'未同期' },
  error:   { bg:'#fff5f5', dot:'#e53935', label:'同期エラー' },
};

function render() {
  const mount = document.getElementById('sync-indicator-mount');
  if (!mount) return;
  const { kind, pending } = syncStatus.get();
  const c = COLORS[kind] || COLORS.idle;
  const tail = (kind === 'offline' || kind === 'error') && pending > 0 ? ` (${pending})` : '';
  mount.innerHTML = `
    <button onclick="window.syncUI && window.syncUI.handleClick()" title="${c.label}${tail}" style="background:${c.bg}; border:none; border-radius:14px; padding:5px 9px; display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:#444; cursor:pointer; font-family:inherit;">
      <span style="width:7px; height:7px; background:${c.dot}; border-radius:50%; display:inline-block;"></span>
      <span>${c.label}${tail}</span>
    </button>
  `;
}

export function init() {
  render();
  syncStatus.onChange(render);
}

export function handleClick() {
  // sync queue を flush（main.js が登録したフックを呼ぶ）
  if (window.matchesService?.flushSync) window.matchesService.flushSync();
}

window.syncUI = { handleClick };
```

- [ ] **Step 3: main.js から init を呼ぶ**

`routeAfterLogin` の `playerUI.rerender();` 直後あたり：

```javascript
import * as syncUI from './sync-ui.js';
// ...
syncUI.init();
```

---

## Task 4: matches.js / opponents.js を temp ID 対応にする

**Files:**
- Modify: `js/matches.js`
- Modify: `js/opponents.js`

ポイント：
- `rowToMatch` / `rowToOpponent` には変更不要（remote row → UI shape）
- create 時に「ローカル即生成オブジェクト」を作る純関数を追加（`buildLocalMatch(tempId, playerId, input)`）
- これにより、Supabase レスポンスを待たずにキャッシュへ即追加できる

- [ ] **Step 1: matches.js に `buildLocalMatch` を追加**

ファイル末尾に追加：

```javascript
export function buildLocalMatch(tempId, playerId, input) {
  const now = new Date().toISOString();
  return rowToMatch({
    id: tempId,
    player_id: playerId,
    date: input.date || new Date().toISOString().slice(0, 10),
    opponent_name: input.opponent || null,
    opponent_team: input.team || null,
    opponent_age: input.age || null,
    opponent_pref: input.pref || null,
    opponent_hand: input.hand || null,
    opponent_type: input.type || null,
    match_type: input.matchType || null,
    score: input.score || null,
    win: input.win,
    tags: input.tags || [],
    memo: input.memo || null,
    created_at: now,
    updated_at: now,
  });
}
```

- [ ] **Step 2: opponents.js に `buildLocalOpponent` を追加**

```javascript
export function buildLocalOpponent(tempId, accountId, input) {
  return rowToOpponent({
    id: tempId,
    account_id: accountId,
    name: input.name,
    team: input.team || null,
    age: input.age || null,
    pref: input.pref || null,
    hand: input.hand || null,
    type: input.type || null,
    created_at: new Date().toISOString(),
  });
}
```

---

## Task 5: matchesService を Optimistic + Queue 化

**Files:**
- Modify: `js/main.js`

設計：
- `create` / `update` / `delete` はキャッシュ即時更新後、Supabase 送信を試行
- 成功すれば temp ID を remote ID に置換（create 時のみ）してキャッシュ再保存
- 失敗（ネットワーク or `!navigator.onLine`）時は queue に積み、`syncStatus` を `offline` に
- `flushSync()` は queue を順次処理、失敗は retries インクリメント、5回超えたら `error` 状態に
- 起動時（`routeAfterLogin` 末尾）と `window.addEventListener('online')` で `flushSync()` を呼ぶ

- [ ] **Step 1: main.js に sync 関連 import 追加**

```javascript
import * as syncQueue from './sync-queue.js';
import * as syncStatus from './sync-status.js';
import * as syncUI from './sync-ui.js';
```

- [ ] **Step 2: matchesService を以下のように書き換え**

```javascript
function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
}

function refreshSyncStatus() {
  const pending = syncQueue.size();
  if (pending === 0) {
    syncStatus.set({ kind: 'idle', pending: 0, lastError: null });
  } else if (!isOnline()) {
    syncStatus.set({ kind: 'offline', pending });
  } else {
    syncStatus.set({ kind: 'syncing', pending });
  }
}

const matchesService = {
  getCurrent() {
    const pid = playerState.getCurrentPlayerId();
    return matchesCache.load(pid);
  },

  async refreshCurrent(onUpdate) {
    const pid = playerState.getCurrentPlayerId();
    if (!pid) return;
    if (!isOnline()) return;
    try {
      const rows = await matches.listByPlayer(pid);
      const remote = rows.map(matches.rowToMatch);
      // queue に残っている temp 行とマージ
      const local = matchesCache.load(pid).filter(m => String(m.id).startsWith('local-'));
      const merged = [...local, ...remote.filter(r => !local.some(l => l._tempIdFor === r.id))];
      matchesCache.save(pid, merged);
      onUpdate?.(merged);
    } catch (e) {
      console.error('Failed to refresh matches:', e);
    }
  },

  async create(matchData) {
    const pid = playerState.getCurrentPlayerId();
    if (!pid) throw new Error('No current player');
    const tempId = `local-${crypto.randomUUID()}`;
    const optimistic = matches.buildLocalMatch(tempId, pid, matchData);
    const list = matchesCache.load(pid);
    list.unshift(optimistic);
    matchesCache.save(pid, list);

    syncQueue.enqueue({ op: 'create', resource: 'match', payload: { tempId, playerId: pid, input: matchData } });
    refreshSyncStatus();
    matchesService.flushSync(); // fire and forget
    return optimistic;
  },

  async update(id, matchData) {
    const pid = playerState.getCurrentPlayerId();
    if (!pid) throw new Error('No current player');
    const list = matchesCache.load(pid);
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...matches.buildLocalMatch(id, pid, matchData) };
      matchesCache.save(pid, list);
    }
    syncQueue.enqueue({ op: 'update', resource: 'match', payload: { id, input: matchData } });
    refreshSyncStatus();
    matchesService.flushSync();
    return list[idx];
  },

  async delete(id) {
    const pid = playerState.getCurrentPlayerId();
    if (!pid) throw new Error('No current player');
    const filtered = matchesCache.load(pid).filter(x => x.id !== id);
    matchesCache.save(pid, filtered);
    if (String(id).startsWith('local-')) {
      // まだ送信していない create を queue から取り消す
      const items = syncQueue.listAll();
      const pending = items.find(it => it.resource === 'match' && it.op === 'create' && it.payload?.tempId === id);
      if (pending) syncQueue.remove(pending.id);
    } else {
      syncQueue.enqueue({ op: 'delete', resource: 'match', payload: { id } });
    }
    refreshSyncStatus();
    matchesService.flushSync();
  },

  async flushSync() {
    if (!isOnline()) { refreshSyncStatus(); return; }
    const items = syncQueue.listAll();
    if (items.length === 0) { refreshSyncStatus(); return; }
    syncStatus.set({ kind: 'syncing', pending: items.length });
    for (const item of items) {
      try {
        await processQueueItem(item);
        syncQueue.remove(item.id);
      } catch (e) {
        const retries = (item.retries || 0) + 1;
        syncQueue.update(item.id, { retries, lastError: String(e?.message || e) });
        if (retries > 5) {
          syncStatus.set({ kind: 'error', pending: syncQueue.size(), lastError: String(e?.message || e) });
          return;
        }
      }
    }
    refreshSyncStatus();
    // flush 後にキャッシュも refresh して remote ID に揃える
    matchesService.refreshCurrent(() => {
      if (typeof window.renderMatches === 'function') window.renderMatches();
    });
    opponentsService.refresh();
  },
};
```

- [ ] **Step 3: `processQueueItem` を main.js に追加**

```javascript
async function processQueueItem(item) {
  if (item.resource === 'match') {
    if (item.op === 'create') {
      const { tempId, playerId, input } = item.payload;
      const row = await matches.createMatch(playerId, input);
      // キャッシュ内の temp 行を remote 行に差し替え
      const list = matchesCache.load(playerId);
      const idx = list.findIndex(x => x.id === tempId);
      if (idx >= 0) {
        list[idx] = matches.rowToMatch(row);
        matchesCache.save(playerId, list);
      }
    } else if (item.op === 'update') {
      const { id, input } = item.payload;
      const row = await matches.updateMatch(id, input);
      const pid = playerState.getCurrentPlayerId();
      if (pid) {
        const list = matchesCache.load(pid);
        const idx = list.findIndex(x => x.id === id);
        if (idx >= 0) {
          list[idx] = matches.rowToMatch(row);
          matchesCache.save(pid, list);
        }
      }
    } else if (item.op === 'delete') {
      await matches.deleteMatch(item.payload.id);
    }
  } else if (item.resource === 'opponent') {
    if (item.op === 'create') {
      const { tempId, accountId, input } = item.payload;
      const row = await opponents.createOpponent(accountId, input);
      const list = opponentsCache.load();
      const idx = list.findIndex(x => x.id === tempId);
      if (idx >= 0) {
        list[idx] = opponents.rowToOpponent(row);
        opponentsCache.save(list);
      }
    } else if (item.op === 'delete') {
      await opponents.deleteOpponent(item.payload.id);
    }
  }
}
```

---

## Task 6: opponentsService も Optimistic + Queue 化

**Files:**
- Modify: `js/main.js`

`matchesService` と同じ構造で `opponentsService` も書き換え。`opponentsCache` は player に依存しないので簡略化。

- [ ] **Step 1: opponentsService を書き換え**

```javascript
const opponentsService = {
  getAll() { return opponentsCache.load(); },

  async refresh(onUpdate) {
    const accountId = lastUid;
    if (!accountId) return;
    if (!isOnline()) return;
    try {
      const rows = await opponents.listAll(accountId);
      const remote = rows.map(opponents.rowToOpponent);
      const local = opponentsCache.load().filter(o => String(o.id).startsWith('local-'));
      const merged = [...local, ...remote];
      opponentsCache.save(merged);
      onUpdate?.(merged);
    } catch (e) {
      console.error('Failed to refresh opponents:', e);
    }
  },

  async create(opp) {
    const accountId = lastUid;
    if (!accountId) throw new Error('Not authenticated');
    const tempId = `local-${crypto.randomUUID()}`;
    const optimistic = opponents.buildLocalOpponent(tempId, accountId, opp);
    const list = opponentsCache.load();
    list.unshift(optimistic);
    opponentsCache.save(list);

    syncQueue.enqueue({ op: 'create', resource: 'opponent', payload: { tempId, accountId, input: opp } });
    refreshSyncStatus();
    matchesService.flushSync();
    return optimistic;
  },

  async delete(id) {
    const filtered = opponentsCache.load().filter(x => x.id !== id);
    opponentsCache.save(filtered);
    if (String(id).startsWith('local-')) {
      const items = syncQueue.listAll();
      const pending = items.find(it => it.resource === 'opponent' && it.op === 'create' && it.payload?.tempId === id);
      if (pending) syncQueue.remove(pending.id);
    } else {
      syncQueue.enqueue({ op: 'delete', resource: 'opponent', payload: { id } });
    }
    refreshSyncStatus();
    matchesService.flushSync();
  },
};
```

---

## Task 7: 起動時・online イベントで flush

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: routeAfterLogin の末尾に flush 呼び出しを追加**

```javascript
playerUI.rerender();
syncUI.init();
matchesService.refreshCurrent(/* ... */);
opponentsService.refresh();
matchesService.flushSync(); // 起動時に積まれているものを送る
```

- [ ] **Step 2: window の online / offline イベントを購読**

`init()` の前あたりに：

```javascript
window.addEventListener('online', () => {
  refreshSyncStatus();
  matchesService.flushSync();
});
window.addEventListener('offline', () => {
  refreshSyncStatus();
});
```

- [ ] **Step 3: 起動直後の sync status 初期化**

```javascript
// init の冒頭
refreshSyncStatus();
```

---

## Task 8: index.html の alert を Optimistic 前提に変更

**Files:**
- Modify: `index.html`

現在 `submitRecord` / `doDeleteMatch` / `addToAB` / `deleteFromAB` / `addPendingToAb` は `try/catch` で失敗時に `alert()` し処理中断している。Optimistic UI では「キャッシュ即更新 + queue に積む」だけなので、これらの async 呼び出しは事実上失敗しなくなる（queue が落ちたら落ちる程度）。alert を消し、UI 即時クローズにする。

- [ ] **Step 1: submitRecord 内の try/catch を簡素化**

`window.matchesService.create / update` は temp ID を即返すので、await の必要性は薄い。ただし戻り値を表示に使っている場合のみ await。失敗時の alert は削除（インジケーターで表現）。

- [ ] **Step 2: doDeleteMatch / deleteFromAB / addToAB / addPendingToAb も同様**

```javascript
async function doDeleteMatch(id) {
  await window.matchesService.delete(id);   // 実質キャッシュ操作 + queue enqueue で即返る
  matches = window.matchesService.getCurrent();
  renderMatches();
  closeConfirm();
  closeModal();
  showScreen('home');
}
```

`alert` 呼び出しは削除。同期失敗はインジケーターで表示する。

---

## Task 9: テスト

**Files:**
- Create: `tests/sync.spec.js`

- [ ] **Step 1: オフライン → 復帰の自動同期テスト**

```javascript
import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

test('オフラインで記録 → オンライン復帰で同期される', async ({ page, context }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });

  await context.setOffline(true);

  await page.click('#fab');
  await page.waitForSelector('#screen-record.active');
  const opponentName = `オフライン-${Date.now()}`;
  await page.fill('#opponent-name', opponentName);
  const inputs = page.locator('input.score-input[data-side="my"]');
  await inputs.nth(0).fill('11');
  await inputs.nth(1).fill('11');
  await inputs.nth(2).fill('11');
  await page.click('button.submit-btn');

  await page.waitForSelector('#screen-home.active', { timeout: 10000 });
  await expect(page.locator('.match-list')).toContainText(opponentName);
  await expect(page.locator('#sync-indicator-mount')).toContainText('未同期', { timeout: 5000 });

  await context.setOffline(false);
  await expect(page.locator('#sync-indicator-mount')).toContainText('同期済み', { timeout: 15000 });

  // リロードしても残る
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home.active');
  await expect(page.locator('.match-list')).toContainText(opponentName, { timeout: 10000 });
});

test('オフラインで削除 → 復帰で反映', async ({ page, context }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });
  await page.waitForSelector('.match-card', { timeout: 10000 });

  const initialCount = await page.locator('.match-card').count();
  expect(initialCount).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.locator('.match-card').first().click();
  await page.click('button:has-text("削除")');
  await page.click('button:has-text("削除する")');
  await page.waitForSelector('#screen-home.active');
  await expect(page.locator('.match-card')).toHaveCount(initialCount - 1);

  await context.setOffline(false);
  await expect(page.locator('#sync-indicator-mount')).toContainText('同期済み', { timeout: 15000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home.active');
  await expect(page.locator('.match-card')).toHaveCount(initialCount - 1);
});
```

- [ ] **Step 2: ローカルで `npx playwright test sync.spec.js` 実行 → 全 PASS**

---

## Task 10: SW バージョン更新 + デプロイ

- [ ] **Step 1: `sw.js` の `CACHE` を `pingpong-v26` 等に進める**
- [ ] **Step 2: `vercel --prod --yes`**
- [ ] **Step 3: 本番手動確認**
  - DevTools の Network タブで Offline をオン → 試合を1件記録 → ホームに表示される
  - インジケーターが「未同期 (1)」になる
  - Offline をオフ → インジケーターが「同期済み」に変わる
  - リロード → 試合が残っている、Supabase Dashboard にレコードがある
  - 同じシナリオを delete / update で実施

---

## 完了条件（Phase 1C の Definition of Done）

- [ ] 圏外で試合を記録 → ホームに即表示される
- [ ] 圏外でアドレス帳に追加 → 一覧に即表示される
- [ ] オンライン復帰で自動的に Supabase に送信される
- [ ] ヘッダーに同期インジケーターが表示される（4状態）
- [ ] インジケーターをタップで明示的に再同期できる
- [ ] 圏外で削除 → 復帰後にリモートからも消える
- [ ] 圏外で同じレコードを編集 → 復帰後に最新版がリモートに反映される
- [ ] queue は localStorage に永続化され、ブラウザ再起動後も保持される
- [ ] retry 5回失敗で `error` 状態になり、ユーザーが再試行できる
- [ ] Playwright `sync.spec.js` が全 PASS
- [ ] 既存の `match.spec.js` `opponent.spec.js` `reload.spec.js` がリグレッションなく PASS

---

## 注意点・既知の制約

- **コンフリクト解決は LWW（Last-Write-Wins）に近いが厳密ではない。** 同じレコードを別端末から編集して両方オフラインで保留 → 復帰時、後から flush した方が勝つ。Phase 2 で `updated_at` 比較ベースのマージに改良予定。
- **temp ID の永続化**：localStorage キャッシュに `local-xxx` ID が残ることがある。flush 後の `refreshCurrent` で remote ID と入れ替わるが、レンダリング側は temp ID を直接表示しない（`rowToMatch` のフィールドのみ使う）ので影響なし。
- **IndexedDB 移行はこのプランでは行わない**。1選手あたりの試合数が爆発的に増えて localStorage 5MB 上限に当たるユーザーが現れたら別フェーズで対応。
- **Realtime 購読（他端末からの変更を即反映）も未対応。** `refreshCurrent` を画面再表示時に明示的に呼ぶことで補完する想定。
- **flushSync は同時呼出しを許容しているが、queue 順序は維持される**（`for of` の逐次処理）。並行 flush の防止が必要なら mutex を追加。

---

## 次のフェーズ

- **Phase 1E**: localStorage migration UI（旧 MVP データのクラウド紐付け）
- **Phase 1F（仮）**: IndexedDB 移行と Realtime 購読
- **Phase 2**: クラブ機能（クラブコード、コーチアカウント、共有アドレス帳）
