# Cloud Phase 1D: Matches & Opponents Cloud CRUD 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 試合 (matches) とアドレス帳 (opponents) を Supabase に保存・同期できるようにする。各試合は player_id で選手に紐付き、ヘッダーで選手切替するとその選手の試合のみ表示される。

**Architecture:**
- 既存の localStorage ベースの matches / addressBook を、Supabase 同期＋localStorage キャッシュ構成へ移行
- Phase 1B の players.js / player-ui.js と同じパターン：CRUD モジュール + キャッシュ層
- 選手切替は playerState の listener を購読し、matches ビューを再描画
- localStorage は読み書きの「即時反応」を担保するキャッシュ。Supabase は「真実の source of truth」
- 既存 localStorage データの自動マイグレーションは Phase 1E で実装（このプランでは扱わない）

**Tech Stack:** Supabase JS Client, Vanilla JS ES modules, Playwright (テスト)

**Spec:** `docs/superpowers/specs/2026-04-25-cloud-phase-1-design.md`

**Phase 1B 完了状態:** 認証・選手管理が動作。試合とアドレス帳は localStorage のまま。`window.matches` / `window.addressBook` というグローバル変数が index.html の inline script で管理されている。

**スコープ:** 完了時点で、新規試合と新規アドレス帳エントリは Supabase に保存される。選手切替で表示される試合が切り替わる。既存 localStorage データの移行は Phase 1E で実装。

---

## ファイル構成

### 新規作成
- `pingpong-app/js/matches.js` — matches テーブルへの CRUD（listByPlayer / create / update / delete）
- `pingpong-app/js/matches-cache.js` — matches を localStorage にキャッシュ（player ごとに分けて保存）
- `pingpong-app/js/opponents.js` — opponents テーブルへの CRUD
- `pingpong-app/js/opponents-cache.js` — opponents を localStorage にキャッシュ
- `pingpong-app/tests/match.spec.js` — 試合記録の Playwright テスト
- `pingpong-app/tests/opponent.spec.js` — アドレス帳の Playwright テスト

### 修正
- `pingpong-app/index.html` — `submitRecord`, `doDeleteMatch`, `addToAB`, `deleteFromAB`, `addPendingToAb`, `renderMatches`, `loadFromStorage`, `saveToStorage` を Supabase 経由に置き換え
- `pingpong-app/js/main.js` — 選手切替時の matches 再描画フックを追加
- `pingpong-app/js/player-state.js` — listener が既にある（変更なし）

---

## Task 1: matches.js（CRUD モジュール）

**Files:**
- Create: `pingpong-app/js/matches.js`

- [ ] **Step 1: matches.js を作成**

```javascript
import { supabase } from './supabase-client.js';

export async function listByPlayer(playerId) {
  if (!playerId) return [];
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('player_id', playerId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createMatch(playerId, match) {
  if (!playerId) throw new Error('player_id is required');
  const row = {
    player_id: playerId,
    date: match.date || new Date().toISOString().slice(0, 10),
    opponent_name: match.opponent || null,
    opponent_team: match.team || null,
    opponent_age: match.age || null,
    opponent_pref: match.pref || null,
    opponent_hand: match.hand || null,
    opponent_type: match.type || null,
    match_type: match.matchType || null,
    score: match.score || null,
    win: match.win,
    tags: match.tags || [],
    memo: match.memo || null,
  };
  const { data, error } = await supabase
    .from('matches')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMatch(id, updates) {
  const row = {
    date: updates.date,
    opponent_name: updates.opponent || null,
    opponent_team: updates.team || null,
    opponent_age: updates.age || null,
    opponent_pref: updates.pref || null,
    opponent_hand: updates.hand || null,
    opponent_type: updates.type || null,
    match_type: updates.matchType || null,
    score: updates.score || null,
    win: updates.win,
    tags: updates.tags || [],
    memo: updates.memo || null,
  };
  const { data, error } = await supabase
    .from('matches')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMatch(id) {
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * Supabase の row を inline script の matches[] と互換のあるオブジェクトに変換
 */
export function rowToMatch(row) {
  return {
    id: row.id,
    date: formatDateJa(row.date),
    team: row.opponent_team || '',
    opponent: row.opponent_name || '',
    age: row.opponent_age || 14,
    pref: row.opponent_pref || '不明',
    hand: row.opponent_hand || '',
    type: row.opponent_type || '不明',
    matchType: row.match_type || '',
    score: row.score || '—',
    win: !!row.win,
    tags: Array.isArray(row.tags) ? row.tags : [],
    memo: row.memo || '',
    _remoteRow: row, // 元データ参照用
  };
}

function formatDateJa(dateStr) {
  // '2026-04-21' → '2026年4月21日'
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}
```

---

## Task 2: matches-cache.js（localStorage キャッシュ）

**Files:**
- Create: `pingpong-app/js/matches-cache.js`

- [ ] **Step 1: matches-cache.js を作成**

```javascript
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
```

---

## Task 3: opponents.js（アドレス帳 CRUD）

**Files:**
- Create: `pingpong-app/js/opponents.js`

- [ ] **Step 1: opponents.js を作成**

```javascript
import { supabase } from './supabase-client.js';

export async function listAll(accountId) {
  if (!accountId) return [];
  const { data, error } = await supabase
    .from('opponents')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createOpponent(accountId, opp) {
  if (!accountId) throw new Error('account_id is required');
  if (!opp.name) throw new Error('name is required');
  const row = {
    account_id: accountId,
    name: opp.name,
    team: opp.team || null,
    age: opp.age || null,
    pref: opp.pref || null,
    hand: opp.hand || null,
    type: opp.type || null,
  };
  const { data, error } = await supabase
    .from('opponents')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOpponent(id) {
  const { error } = await supabase
    .from('opponents')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * row を inline script の addressBook[] と互換のあるオブジェクトに変換
 */
export function rowToOpponent(row) {
  return {
    id: row.id,
    name: row.name,
    team: row.team || '',
    age: row.age || 0,
    pref: row.pref || '',
    hand: row.hand || '',
    type: row.type || '',
  };
}
```

---

## Task 4: opponents-cache.js

**Files:**
- Create: `pingpong-app/js/opponents-cache.js`

- [ ] **Step 1: opponents-cache.js を作成**

```javascript
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
```

---

## Task 5: matchesService（main.js から呼ぶ統合層）

**Files:**
- Modify: `pingpong-app/js/main.js`

`matches.js`（Supabase）と `matches-cache.js`（localStorage）を組み合わせ、現在選手の試合一覧を取り出す統合関数を main.js に追加する。inline script からは `window.matchesService.*` 経由で呼ぶ。

- [ ] **Step 1: main.js に matches/opponents の import を追加**

```javascript
import * as matches from './matches.js';
import * as matchesCache from './matches-cache.js';
import * as opponents from './opponents.js';
import * as opponentsCache from './opponents-cache.js';
```

- [ ] **Step 2: matchesService と opponentsService を構築**

main.js の最下部の `init();` の前に追加：

```javascript
const matchesService = {
  /** 現在選手の matches をキャッシュから即取得（inline scriptが描画用に使う） */
  getCurrent() {
    const pid = playerState.getCurrentPlayerId();
    return matchesCache.load(pid);
  },

  /** バックグラウンドで Supabase から fetch しキャッシュ更新後 onUpdate を呼ぶ */
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

  async delete(id) {
    await opponents.deleteOpponent(id);
    const list = opponentsCache.load().filter(x => x.id !== id);
    opponentsCache.save(list);
  },
};

window.matchesService = matchesService;
window.opponentsService = opponentsService;
```

- [ ] **Step 3: routeAfterLogin で matches / opponents もリフレッシュ**

`routeAfterLogin()` の `playerUI.rerender();` の直後に追加：

```javascript
matchesService.refreshCurrent(() => {
  if (typeof window.renderMatches === 'function') window.renderMatches();
});
opponentsService.refresh();
```

- [ ] **Step 4: 選手切替時に matches を再描画**

`playerState.onCurrentPlayerChange` を購読する：

```javascript
playerState.onCurrentPlayerChange(() => {
  matchesService.refreshCurrent(() => {
    if (typeof window.renderMatches === 'function') window.renderMatches();
  });
});
```

これも `init();` の前に追加。

- [ ] **Step 5: ログアウト時にキャッシュもクリア**

`SIGNED_OUT` ハンドラ内の `playerUI.clearCache();` の後に：

```javascript
matchesCache.clearAll();
opponentsCache.clearAll();
```

---

## Task 6: index.html の matches を Supabase 経由に置き換え

**Files:**
- Modify: `pingpong-app/index.html`

inline script の `matches` / `addressBook` 配列の参照箇所を Supabase 経由に変更する。

- [ ] **Step 1: 起動時のサンプルデータを空に**

inline script 上部の `let matches = [...]` のサンプルデータを削除して空配列に：

```javascript
let matches = [];
let addressBook = [];
```

サンプル選手データも不要だが、影響範囲が大きい場合は触らない（後で消す）。

- [ ] **Step 2: loadFromStorage を Supabase キャッシュ読込に置き換え**

```javascript
function loadFromStorage() {
  if (window.matchesService) {
    matches = window.matchesService.getCurrent();
  }
  if (window.opponentsService) {
    addressBook = window.opponentsService.getAll();
  }
}
```

- [ ] **Step 3: saveToStorage を no-op に（将来のため残す）**

```javascript
function saveToStorage() {
  // データはサービス層でクラウド+キャッシュへ保存される
}
```

- [ ] **Step 4: window.renderMatches を再ロード対応に**

`window.renderMatches` を更新して、呼ばれるたびにキャッシュから最新を取得するように：

```javascript
window.renderMatches = function() {
  if (window.matchesService) {
    matches = window.matchesService.getCurrent();
  }
  renderMatches();
};
```

これで、main.js で `window.renderMatches()` を呼ぶたびに最新キャッシュが反映される。

- [ ] **Step 5: submitRecord を matchesService.create / update に置き換え**

既存の `submitRecord` 内の：
```javascript
matches.unshift(newMatch);
renderMatches();
```
の部分を以下に置き換え：

```javascript
const isEditing = editingMatchId !== null;
try {
  if (isEditing) {
    await window.matchesService.update(editingMatchId, newMatch);
  } else {
    await window.matchesService.create(newMatch);
  }
  // キャッシュ → matches[] → 描画
  matches = window.matchesService.getCurrent();
  renderMatches();
} catch (e) {
  alert('保存に失敗しました：' + e.message);
  return;
}
```

submitRecord は async function に変更する必要がある：
```javascript
async function submitRecord() { ... }
```

そして `editingMatchId` のリセット位置を `update` の成功後に動かす：

```javascript
if (isEditing) {
  // ...
  editingMatchId = null;
}
```

- [ ] **Step 6: doDeleteMatch を matchesService.delete に置き換え**

```javascript
async function doDeleteMatch(id) {
  try {
    await window.matchesService.delete(id);
    matches = window.matchesService.getCurrent();
    renderMatches();
  } catch (e) {
    alert('削除に失敗しました：' + e.message);
    return;
  }
  closeConfirm();
  closeModal();
  showScreen('home');
  // ... トースト
}
```

- [ ] **Step 7: addToAB / deleteFromAB / addPendingToAb を opponentsService に置き換え**

`addToAB`：
```javascript
async function addToAB() {
  // ... 既存の入力取得
  if (!name) return;
  try {
    await window.opponentsService.create({ name, team, age, pref, hand: abSelectedHand, type: abSelectedType });
    addressBook = window.opponentsService.getAll();
  } catch (e) {
    alert('登録に失敗しました：' + e.message);
    return;
  }
  abSelectedHand = '';
  abSelectedType = '';
  renderAddressBook();
}
```

`deleteFromAB`：
```javascript
async function deleteFromAB(idx) {
  const item = addressBook[idx];
  if (!item) return;
  try {
    await window.opponentsService.delete(item.id);
    addressBook = window.opponentsService.getAll();
  } catch (e) {
    alert('削除に失敗しました：' + e.message);
    return;
  }
  renderAddressBook();
}
```

`addPendingToAb`：
```javascript
async function addPendingToAb() {
  if (_pendingMatchForAb) {
    try {
      await window.opponentsService.create({
        name: _pendingMatchForAb.opponent,
        team: _pendingMatchForAb.team,
        age: _pendingMatchForAb.age,
        pref: _pendingMatchForAb.pref,
        hand: _pendingMatchForAb.hand,
        type: _pendingMatchForAb.type,
      });
      addressBook = window.opponentsService.getAll();
    } catch (e) {
      console.error('Failed to add to address book:', e);
    }
    _pendingMatchForAb = null;
  }
  closeConfirm();
}
```

---

## Task 7: テスト追加

**Files:**
- Create: `pingpong-app/tests/match.spec.js`
- Create: `pingpong-app/tests/opponent.spec.js`

- [ ] **Step 1: match.spec.js**

```javascript
import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

test('試合を記録するとホーム画面に表示される', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  // 切替UIが描画されるまで待つ
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });

  // 試合記録画面へ
  await page.click('#fab');
  await page.waitForSelector('#screen-record.active');

  const opponentName = `テスト相手-${Date.now()}`;
  await page.fill('#opponent-name', opponentName);
  // 最低限、自分の点数を 11 入れる（3セット）
  const inputs = page.locator('input.score-input[data-side="my"]');
  await inputs.nth(0).fill('11');
  await inputs.nth(1).fill('11');
  await inputs.nth(2).fill('11');

  await page.click('button.submit-btn');

  // ホームに戻り、対戦相手名が表示される
  await page.waitForSelector('#screen-home.active', { timeout: 10000 });
  await expect(page.locator('.match-list')).toContainText(opponentName, { timeout: 10000 });
});

test('リロード後も試合が表示される', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });
  // 既存の試合数を取得
  await page.waitForTimeout(2000); // データ取得待ち
  const initialCount = await page.locator('.match-card').count();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home.active');
  await expect(page.locator('.match-card')).toHaveCount(initialCount, { timeout: 10000 });
});
```

- [ ] **Step 2: opponent.spec.js**

```javascript
import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

test('アドレス帳に追加 → リロード後も残る', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });

  // 試合記録画面 → アドレス帳
  await page.click('#fab');
  await page.waitForSelector('#screen-record.active');
  await page.click('text=📋 アドレス帳');

  const newName = `テスト選手-${Date.now()}`;
  await page.fill('#ab-name', newName);
  await page.fill('#ab-team', 'テストチーム');
  await page.click('button:has-text("登録する")');
  await expect(page.locator('#ab-content')).toContainText(newName, { timeout: 5000 });

  // リロード
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home.active');
  await page.click('#fab');
  await page.waitForSelector('#screen-record.active');
  await page.click('text=📋 アドレス帳');
  await expect(page.locator('#ab-content')).toContainText(newName, { timeout: 5000 });
});
```

- [ ] **Step 3: テスト実行**

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
npx playwright test --reporter=line
```

全テスト PASS を確認。失敗があれば原因特定して修正。

---

## Task 8: SW バージョン更新 + デプロイ

- [ ] **Step 1: SW キャッシュ名を更新**

`pingpong-app/sw.js` の `const CACHE = 'pingpong-vXX'` を1つ進める。

- [ ] **Step 2: Vercel にデプロイ**

```bash
vercel --prod --yes
```

- [ ] **Step 3: 本番で手動確認**

ハードリロード（Cmd+Shift+R）後：
- 試合を1件記録 → ホームに表示される
- リロード → 試合が残ってる
- アドレス帳に追加 → リロード後も残ってる
- 別の選手に切替 → その選手の試合だけ表示
- Supabase Dashboard で `matches`, `opponents` テーブルにレコードがあること

---

## 完了条件（Phase 1D の Definition of Done）

- [ ] 試合記録ボタンで matches テーブルに行が作られる
- [ ] 試合カードがホームに表示される
- [ ] リロード後も試合が表示される
- [ ] 選手切替で表示される試合が切り替わる
- [ ] 試合の編集が Supabase に反映される
- [ ] 試合の削除が Supabase に反映される
- [ ] アドレス帳の追加が opponents テーブルに反映される
- [ ] アドレス帳の削除が反映される
- [ ] アドレス帳追加プロンプト（試合記録後）も Supabase に書く
- [ ] Playwright テストが全 PASS
- [ ] localStorage キャッシュにより、オフラインでも一瞬で UI が出る

---

## 注意点・既知の制約

- **既存 localStorage の試合データは Phase 1D ではマイグレートされない。** localStorage に古いデータがあっても、ログイン後は Supabase ベースの新しい試合のみが表示される。Phase 1E で「ローカルにxx試合あります。アカウントに紐付けますか？」UI を追加して移行する予定。
- このプランの時点では、サンプル試合データ（山田健太など）はローカル変数の初期値からは消えるが、すでに localStorage に保存されている場合は見える可能性あり（Phase 1E でクリア処理を入れる）。
- アドレス帳のクラブ共有（Phase 2）は未対応。account 単位のプライベート扱い。
- 「同一人物判定」（部分一致 + チーム + 学年）の logic は inline script に残っている。Supabase ベースの addressBook で動作確認すること。

---

## 次のフェーズ

- **Phase 1E**: localStorage migration UI（既存ローカルデータをクラウドへ移行）
- **Phase 2**: クラブ機能（クラブコード、コーチアカウント、チーム内閲覧、アドレス帳共有）
