# Cloud Phase 1E: localStorage Migration 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** クラウド版に切り替える前に MVP（localStorage のみの旧バージョン）を使っていたユーザーが、初回ログイン時に「ローカルに残っている試合・アドレス帳をアカウントに紐付ける」モーダル経由でクラウドへ移行できるようにする。

**Architecture:**
- ログイン直後（または初回オンボーディング完了直後）に旧 localStorage キーをチェック
- 該当データが見つかったらモーダルを表示。選手プルダウンで紐付け先を選ばせ、一括 create
- 成功したキーは `pingpong_legacy_*` にリネームしてバックアップ（万一移行ミスで失われた場合の救済用）
- 失敗時は再試行 UI を提供

**Tech Stack:** Vanilla JS ES modules、Phase 1C の `matchesService` / `opponentsService`（あれば Optimistic 経由、無ければ Phase 1D の async 経由）、Playwright（テスト）

**Spec:** `docs/superpowers/specs/2026-04-25-cloud-phase-1-design.md` §6

**Phase 1D 完了状態:** 試合 / アドレス帳は Supabase 経由で保存される。旧 localStorage データは無視されるため、機種変更前に MVP を使っていたユーザーは過去の記録が見えない状態。

**スコープ:** 完了時点で「初回ログイン時に旧データが検出されモーダルが出る」「紐付け実行で全データがクラウドに移る」「成功後はモーダルが二度と出ない」「失敗しても元データが localStorage から消えない」状態。クラブ共有や複数選手への振り分け配分は対象外（1選手に全試合を紐付ける単純な UI のみ）。

---

## ⚠️ 実装前に確認すべきこと

**旧 MVP の localStorage キー名**は spec §6 では `pingpong_matches` / `pingpong_addressbook` とされているが、現コードベースには痕跡が残っていない（Phase 1D で書き換えた際に削除済み）。実装着手前に以下のいずれかで実キーを確認：

1. 本番ユーザーの DevTools → Application → Local Storage を直接確認
2. MVP 時代のコミット履歴を別 origin から取得（プロジェクト最初期の `pingpong-prototype.html` を遡る）
3. 自分の本番ブラウザで MVP 由来の key が残っているか確認

確認できた key 名で **Task 1 Step 1** の定数を置き換えること。**仮にキーが見つからなければこのフェーズは不要**で、その旨を確認してこのプランをクローズすればよい。

このプラン本文では仮値として `LEGACY_MATCHES_KEY = 'pingpong_matches'`、`LEGACY_OPPONENTS_KEY = 'pingpong_addressbook'` を使う。

---

## ファイル構成

### 新規作成
- `js/legacy-migration.js` — 検出・モーダル制御・移行処理
- `tests/migration.spec.js` — Playwright テスト

### 修正
- `index.html` — 移行モーダル HTML を追加
- `js/main.js` — `routeAfterLogin` 末尾で `legacyMigration.checkAndPrompt()` を呼ぶ
- `js/onboarding.js` — オンボーディング完了直後にもチェックを呼ぶ

---

## Task 1: legacy-migration.js（検出・state）

**Files:**
- Create: `js/legacy-migration.js`

設計：
- `pingpong_legacy_migration_done` という completion flag をユーザーごとに保存（実際は account.id ベースのキー）して、二度モーダルを出さない
- 移行成功後は旧キーを `pingpong_legacy_<key>` にリネーム（削除はしない、安心のため）
- 部分失敗時は元キーを残し、`pingpong_legacy_pending_<account_id>` フラグを立てて次回ログイン時に再表示

- [ ] **Step 1: 検出関数を実装**

```javascript
// js/legacy-migration.js

const LEGACY_MATCHES_KEY = 'pingpong_matches';        // ⚠️ 実装前に本番値で要確認
const LEGACY_OPPONENTS_KEY = 'pingpong_addressbook';  // ⚠️ 同上

const DONE_KEY_PREFIX = 'pingpong_legacy_done_';
const BACKUP_KEY_PREFIX = 'pingpong_legacy_';

function safeParse(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function detect() {
  const matches = safeParse(localStorage.getItem(LEGACY_MATCHES_KEY));
  const opponents = safeParse(localStorage.getItem(LEGACY_OPPONENTS_KEY));
  return {
    matches: Array.isArray(matches) ? matches : [],
    opponents: Array.isArray(opponents) ? opponents : [],
  };
}

export function isDone(accountId) {
  if (!accountId) return false;
  return localStorage.getItem(DONE_KEY_PREFIX + accountId) === '1';
}

function markDone(accountId) {
  localStorage.setItem(DONE_KEY_PREFIX + accountId, '1');
}

function backupAndClear(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return;
  localStorage.setItem(BACKUP_KEY_PREFIX + key, raw);
  localStorage.removeItem(key);
}
```

---

## Task 2: 移行モーダル HTML

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 既存の `<!-- 選手追加・編集モーダル -->` の直後に追加**

```html
<!-- 旧データ移行モーダル -->
<div class="modal-overlay" id="legacy-migration-modal">
  <div class="modal" id="legacy-migration-content"></div>
</div>
```

- [ ] **Step 2: モーダル外クリックで閉じない設定**

このモーダルはユーザーが意図して「キャンセル」または「紐付ける」を押すまで閉じない。`index.html` の他モーダルと違い、外側クリックでは閉じないようハンドラを追加しない。

---

## Task 3: モーダル UI レンダリング

**Files:**
- Modify: `js/legacy-migration.js`

- [ ] **Step 1: render 関数とコントローラーを追加**

```javascript
import * as players from './players.js';
import * as playerState from './player-state.js';

let state = {
  detected: { matches: [], opponents: [] },
  playerList: [],
  selectedPlayerId: null,
  status: 'idle', // 'idle' | 'running' | 'partial' | 'error'
  error: null,
  progress: { matchesDone: 0, opponentsDone: 0 },
};

function render() {
  const el = document.getElementById('legacy-migration-content');
  if (!el) return;
  const { detected, playerList, selectedPlayerId, status, error, progress } = state;
  const m = detected.matches.length;
  const o = detected.opponents.length;

  if (status === 'running') {
    el.innerHTML = `
      <div class="modal-header"><div class="modal-title">紐付け中…</div></div>
      <div style="padding:18px 0; font-size:14px; color:#444; line-height:1.7;">
        試合: ${progress.matchesDone}/${m} 件<br>
        アドレス帳: ${progress.opponentsDone}/${o} 件
      </div>
    `;
    return;
  }

  if (status === 'error') {
    el.innerHTML = `
      <div class="modal-header"><div class="modal-title">紐付けに失敗しました</div></div>
      <div style="padding:14px 0; font-size:13px; color:#c62828;">${error || '通信エラー'}</div>
      <div style="display:flex; gap:10px;">
        <button onclick="legacyMigration.cancel()" style="flex:1; padding:14px; background:#fff; color:#666; border:1.5px solid #e0e0e0; border-radius:12px; font-weight:700; cursor:pointer;">あとで</button>
        <button onclick="legacyMigration.run()" style="flex:1; padding:14px; background:linear-gradient(135deg,#e53935,#c62828); color:#fff; border:none; border-radius:12px; font-weight:700; cursor:pointer;">再試行</button>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div class="modal-header"><div class="modal-title">過去のデータを引き継ぐ</div></div>
    <div style="padding:14px 0 18px; font-size:13px; color:#444; line-height:1.7;">
      この端末に <b>${m}試合</b> と <b>${o}件のアドレス帳</b> が保存されています。<br>
      アカウントに紐付けますか？
    </div>
    <div class="form-row" style="margin-bottom:16px;">
      <label>紐付ける選手</label>
      <select id="legacy-migration-player-select">
        ${playerList.map(p => `<option value="${p.id}"${p.id === selectedPlayerId ? ' selected' : ''}>${p.name}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex; gap:10px;">
      <button onclick="legacyMigration.cancel()" style="flex:1; padding:14px; background:#fff; color:#666; border:1.5px solid #e0e0e0; border-radius:12px; font-weight:700; cursor:pointer;">キャンセル</button>
      <button onclick="legacyMigration.run()" style="flex:1; padding:14px; background:linear-gradient(135deg,#e53935,#c62828); color:#fff; border:none; border-radius:12px; font-weight:700; cursor:pointer;">紐付ける</button>
    </div>
  `;
}

function open() {
  document.getElementById('legacy-migration-modal').classList.add('show');
  render();
}

function close() {
  document.getElementById('legacy-migration-modal').classList.remove('show');
}
```

---

## Task 4: 移行処理（順次 create）

**Files:**
- Modify: `js/legacy-migration.js`

- [ ] **Step 1: run / cancel を実装**

```javascript
import * as matchesService from './matches.js'; // direct fallback
import * as opponentsService from './opponents.js';

export async function checkAndPrompt(accountId) {
  if (!accountId) return;
  if (isDone(accountId)) return;

  const detected = detect();
  if (detected.matches.length === 0 && detected.opponents.length === 0) {
    markDone(accountId);
    return;
  }

  const playerList = await players.listPlayers();
  if (playerList.length === 0) {
    // オンボーディング前に呼ばれた場合は一旦スキップ。オンボーディング後に再度呼ばれる
    return;
  }

  state = {
    detected,
    playerList,
    selectedPlayerId: playerState.getCurrentPlayerId() || playerList[0].id,
    status: 'idle',
    error: null,
    progress: { matchesDone: 0, opponentsDone: 0 },
  };
  open();
}

async function run() {
  const select = document.getElementById('legacy-migration-player-select');
  if (select) state.selectedPlayerId = select.value;

  state.status = 'running';
  state.progress = { matchesDone: 0, opponentsDone: 0 };
  state.error = null;
  render();

  const pid = state.selectedPlayerId;
  const accountId = window.lastUid || (await window.supabase.auth.getUser()).data.user?.id;

  try {
    // 1. 試合を順次 create（残ったままを覚えておく）
    const remainingMatches = [];
    for (const legacy of state.detected.matches) {
      try {
        const input = legacyMatchToInput(legacy);
        if (window.matchesService) {
          // matchesService 経由（Phase 1C 以降は Optimistic + queue になる）
          await window.matchesService.create({ ...input, _forcePlayerId: pid });
        } else {
          // フォールバック: 直接 create
          await directCreateMatch(pid, input);
        }
        state.progress.matchesDone += 1;
        render();
      } catch (e) {
        console.error('Failed to migrate match:', e, legacy);
        remainingMatches.push(legacy);
      }
    }

    // 2. アドレス帳を順次 create
    const remainingOpponents = [];
    for (const legacy of state.detected.opponents) {
      try {
        const input = legacyOpponentToInput(legacy);
        if (window.opponentsService) {
          await window.opponentsService.create(input);
        } else {
          await directCreateOpponent(accountId, input);
        }
        state.progress.opponentsDone += 1;
        render();
      } catch (e) {
        console.error('Failed to migrate opponent:', e, legacy);
        remainingOpponents.push(legacy);
      }
    }

    // 3. 結果に応じてキーを処理
    if (remainingMatches.length === 0 && remainingOpponents.length === 0) {
      backupAndClear(LEGACY_MATCHES_KEY);
      backupAndClear(LEGACY_OPPONENTS_KEY);
      markDone(accountId);
      close();
      // ホーム再描画
      if (typeof window.renderMatches === 'function') window.renderMatches();
    } else {
      // 部分失敗：残りだけを元キーに書き戻す
      if (remainingMatches.length > 0) {
        localStorage.setItem(LEGACY_MATCHES_KEY, JSON.stringify(remainingMatches));
      } else {
        backupAndClear(LEGACY_MATCHES_KEY);
      }
      if (remainingOpponents.length > 0) {
        localStorage.setItem(LEGACY_OPPONENTS_KEY, JSON.stringify(remainingOpponents));
      } else {
        backupAndClear(LEGACY_OPPONENTS_KEY);
      }
      state.status = 'error';
      state.error = `${remainingMatches.length}件の試合、${remainingOpponents.length}件のアドレス帳が失敗しました。`;
      render();
    }
  } catch (e) {
    state.status = 'error';
    state.error = String(e?.message || e);
    render();
  }
}

function cancel() {
  close();
  // done フラグは立てない。次回ログイン時に再度モーダル表示
}

window.legacyMigration = { run, cancel };
```

- [ ] **Step 2: legacyMatchToInput / legacyOpponentToInput を実装**

旧 MVP のオブジェクト shape に合わせて変換。実 shape を確認するまでは `match` オブジェクトの全フィールドをそのまま渡す形にしておき、本番値が分かった段階で調整する：

```javascript
function legacyMatchToInput(m) {
  return {
    date: typeof m.date === 'string' ? m.date : new Date(m.date || Date.now()).toISOString().slice(0,10),
    opponent: m.opponent || m.opponentName || '',
    team: m.team || m.opponentTeam || null,
    age: typeof m.age === 'number' ? m.age : null,
    pref: m.pref || null,
    hand: m.hand || null,
    type: m.type || null,
    matchType: m.matchType || null,
    score: m.score || null,
    win: !!m.win,
    tags: Array.isArray(m.tags) ? m.tags : [],
    memo: m.memo || null,
  };
}

function legacyOpponentToInput(o) {
  return {
    name: o.name,
    team: o.team || null,
    age: typeof o.age === 'number' ? o.age : null,
    pref: o.pref || null,
    hand: o.hand || null,
    type: o.type || null,
  };
}
```

- [ ] **Step 3: directCreateMatch / directCreateOpponent**

`matchesService` が存在しない場合のフォールバック（Phase 1C 未実装環境では使われる）：

```javascript
async function directCreateMatch(pid, input) {
  const matchesMod = await import('./matches.js');
  await matchesMod.createMatch(pid, input);
}
async function directCreateOpponent(accountId, input) {
  const opponentsMod = await import('./opponents.js');
  await opponentsMod.createOpponent(accountId, input);
}
```

注: `matchesService.create` は現在 `_forcePlayerId` をサポートしていない。Task 6 で main.js を改修して受け取れるようにするか、移行時のみ playerState を一時的に切り替える方法で対応する。後者の方が影響範囲小なので、Step 1 のループを「`playerState.setCurrentPlayerId(pid)` で切替 → create → 元に戻す」に変える方針も可。実装時に決める。

---

## Task 5: routeAfterLogin / オンボーディング完了から呼び出す

**Files:**
- Modify: `js/main.js`
- Modify: `js/onboarding.js`

- [ ] **Step 1: main.js の routeAfterLogin 末尾に追加**

```javascript
import * as legacyMigration from './legacy-migration.js';
// ...
// matchesService.refreshCurrent / opponentsService.refresh の後
legacyMigration.checkAndPrompt(lastUid);
```

- [ ] **Step 2: onboarding.js の submit 成功直後にも呼ぶ**

新規アカウントが選手登録を完了した直後、player リストが空ではなくなるので：

```javascript
// onboarding.js submit() 末尾
if (window.legacyMigration) {
  const accountId = (await window.supabase.auth.getUser()).data.user?.id;
  window.legacyMigration.checkAndPrompt(accountId);
}
```

---

## Task 6: matchesService.create に `_forcePlayerId` を実装（任意）

**Files:**
- Modify: `js/main.js`

Task 4 Step 3 注の通り、移行時に「現在選手とは別の選手に紐付ける」ケースは現状の `matchesService.create` では扱えない。最小改修で `playerState` 一時切替方式にしたい場合は Task 6 をスキップできる。

ここではシンプルに「移行ループ中は呼び出し元で `playerState.setCurrentPlayerId` を切り替え、終わったら戻す」方針で進める。Task 6 自体は省略可。

---

## Task 7: テスト

**Files:**
- Create: `tests/migration.spec.js`

- [ ] **Step 1: localStorage に旧データを注入したログインフロー**

```javascript
import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

test('旧データがあると移行モーダルが出て、紐付け実行で消える', async ({ page }) => {
  await page.goto('/');
  // ログイン前に localStorage に旧データを差し込む
  await page.evaluate(() => {
    localStorage.setItem('pingpong_matches', JSON.stringify([
      { date: '2026-04-01', opponent: '移行テスト相手', team: '旧チーム', age: 12, win: true, tags: [], memo: 'legacy', score: '11-5, 11-7, 11-9' },
    ]));
    localStorage.setItem('pingpong_addressbook', JSON.stringify([
      { name: '移行アドレス', team: '旧チーム', age: 12 },
    ]));
  });

  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#legacy-migration-modal.show')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#legacy-migration-content')).toContainText('1試合');
  await page.click('button:has-text("紐付ける")');
  await expect(page.locator('#legacy-migration-modal.show')).toBeHidden({ timeout: 15000 });
  await expect(page.locator('.match-list')).toContainText('移行テスト相手', { timeout: 10000 });

  // 旧キーがバックアップに移っていることを確認
  const backupExists = await page.evaluate(() => localStorage.getItem('pingpong_legacy_pingpong_matches') !== null);
  expect(backupExists).toBe(true);
  const originalGone = await page.evaluate(() => localStorage.getItem('pingpong_matches') === null);
  expect(originalGone).toBe(true);

  // 再ログインでもモーダルは出ない
  await page.reload();
  await page.waitForSelector('#screen-home.active');
  await expect(page.locator('#legacy-migration-modal.show')).toBeHidden();
});

test('キャンセルすると次回ログイン時にもう一度出る', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('pingpong_matches', JSON.stringify([
      { date: '2026-04-02', opponent: 'cancel-test', win: false, score: '8-11, 7-11, 9-11' },
    ]));
  });
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#legacy-migration-modal.show')).toBeVisible({ timeout: 10000 });
  await page.click('button:has-text("キャンセル")');
  await expect(page.locator('#legacy-migration-modal.show')).toBeHidden();

  // リロード → 再表示
  await page.reload();
  await expect(page.locator('#legacy-migration-modal.show')).toBeVisible({ timeout: 10000 });
});
```

- [ ] **Step 2: ローカル実行で全 PASS を確認**

```bash
npx playwright test migration.spec.js --reporter=line
```

---

## Task 8: SW バージョン更新 + デプロイ

- [ ] **Step 1: `sw.js` の `CACHE` を1つ進める**
- [ ] **Step 2: Vercel にデプロイ**
- [ ] **Step 3: 本番手動確認**
  - 旧 MVP からの本番ユーザー（自分の端末で確認可能なら）でログイン → モーダル表示 → 紐付け
  - DevTools の Application → Local Storage で `pingpong_legacy_*` バックアップが残っていること
  - Supabase Dashboard で件数が一致すること
  - 別端末でログイン → モーダル出ない（done フラグはアカウント単位なので、別端末にも legacy データがあれば再表示される。意図通りで OK）

---

## 完了条件（Phase 1E の Definition of Done）

- [ ] 旧 localStorage キー（実 key 確定後）が検出される
- [ ] 検出時に移行モーダルが表示される
- [ ] 紐付け先選手をプルダウンで選べる（複数選手の場合）
- [ ] 「紐付ける」で全件 create が実行され、進捗が表示される
- [ ] 全件成功で旧キーがバックアップに移り、`done` フラグが立つ
- [ ] 一部失敗時は残データが元キーに残り、再試行できる
- [ ] 完全失敗時もユーザーは再試行できる、データは失われない
- [ ] 「キャンセル」では `done` フラグが立たず、次回再表示される
- [ ] Phase 1C と組み合わせた場合、移行で生成された create も sync queue 経由で送られる
- [ ] Playwright `migration.spec.js` が PASS

---

## 注意点・既知の制約

- **本番ユーザーの localStorage キー名は要確認**。spec §6 の値（`pingpong_matches` / `pingpong_addressbook`）はあくまで spec ベース。実装着手前に確認すること。
- **複数選手への振り分けは未対応**。1選手に全試合を紐付けるシンプルな UI のみ。兄弟ケースで「半分は太郎、半分は次郎」という要望が出たら別フェーズ。
- **同一試合の重複防止は無し**。同じ legacy キーが残っている端末から複数回ログインしても2度モーダルが出ないよう `done` フラグで制御するが、複数端末から並行で「紐付ける」を押した場合は重複する可能性がある（実害は限定的、手動削除で対応）。
- **legacy データのバックアップは localStorage に置く**。容量が逼迫しているユーザー（移行直前で 5MB 近い）は失敗する可能性。その場合は backup 省略して直接 remove するオプションを将来追加。
- **Phase 1C より先に実装する場合**、`matchesService.create` は同期書き込みなので途中で失敗するとそこで止まる（Optimistic UI ではない）。retry UI でカバー。

---

## 次のフェーズ

- **Phase 1F（仮）**: IndexedDB 移行と Realtime 購読
- **Phase 2**: クラブ機能、コーチアカウント、共有アドレス帳
