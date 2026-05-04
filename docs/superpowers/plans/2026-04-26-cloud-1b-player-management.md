# Cloud Phase 1B: Player Management 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログインしたユーザーが「選手」を作成・編集・切替できるようにする。新規登録直後はオンボーディングで最初の選手を登録させる。兄弟（複数選手）対応。

**Architecture:**
- `players` テーブルへの CRUD 操作を `js/players.js` に集約
- 現在選択中の選手は localStorage で端末ローカルに保持（`js/player-state.js`）
- オンボーディング画面（screen-onboarding）を index.html に追加、`js/onboarding.js` で制御
- ヘッダーに選手切替ドロップダウン（選手1人なら非表示）

**Tech Stack:** Supabase JS Client、Vanilla JS ES modules

**Spec:** `docs/superpowers/specs/2026-04-25-cloud-phase-1-design.md`

**Phase 1A 完了状態:** 認証（メール+パスワード／Google）が動作し、`accounts` テーブルに自動でレコードが作られる。試合機能は localStorage ベースのまま動いている。

**スコープ:** このプランは Phase 1B。完了時点で「ログイン後オンボーディング → 選手登録 → ホーム画面、ヘッダーで選手切替できる」状態になる。試合データの player_id 連動は Phase 1D（このプランでは matches は localStorage のまま、選手切替UIは表示するだけで実際のフィルターはしない）。

---

## ファイル構成

### 新規作成
- `pingpong-app/js/players.js` — players テーブルへの CRUD
- `pingpong-app/js/player-state.js` — 現在選手の state 管理 (localStorage)
- `pingpong-app/js/onboarding.js` — オンボーディング画面の制御
- `pingpong-app/js/player-ui.js` — ヘッダー切替・選手追加/編集モーダルの UI

### 修正
- `pingpong-app/index.html` — `screen-onboarding` HTML追加、ヘッダーに選手切替UI挿入箇所追加
- `pingpong-app/js/main.js` — オンボーディング判定を init に組み込み
- `pingpong-app/js/auth-ui.js` — ログイン成功後フック修正（オンボーディング判定との接続）

---

## Task 1: players.js (CRUD モジュール)

**Files:**
- Create: `pingpong-app/js/players.js`

- [ ] **Step 1: players.js を作成**

```javascript
import { supabase } from './supabase-client.js';

export async function listPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPlayer({ name, grade, hand = null, play_type = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  if (!name) throw new Error('Name is required');

  const { data, error } = await supabase
    .from('players')
    .insert({ account_id: user.id, name, grade, hand, play_type })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(id, updates) {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(id) {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: main.js に export を追加して window 公開**

```javascript
// main.js (既存の import に追加)
import * as players from './players.js';
window.players = players;
```

- [ ] **Step 3: 動作確認 (ブラウザ DevTools)**

1. `vercel --prod --yes` でデプロイ
2. ログインした状態でコンソール:
```javascript
await window.players.listPlayers()
// → [] （まだ選手なし）

await window.players.createPlayer({ name: 'テスト太郎', grade: '13' })
// → { id: '...', name: 'テスト太郎', ... }

await window.players.listPlayers()
// → [{ id: '...', name: 'テスト太郎', ... }]
```

3. Supabase の Table Editor で `players` テーブルにレコードが見えることを確認

---

## Task 2: player-state.js (現在選手 state)

**Files:**
- Create: `pingpong-app/js/player-state.js`

- [ ] **Step 1: player-state.js を作成**

```javascript
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
```

- [ ] **Step 2: main.js に追加**

```javascript
import * as playerState from './player-state.js';
window.playerState = playerState;
```

- [ ] **Step 3: 動作確認 (DevTools)**

```javascript
window.playerState.setCurrentPlayerId('test-123')
window.playerState.getCurrentPlayerId() // → 'test-123'
localStorage.getItem('pingpong_current_player_id') // → 'test-123'
window.playerState.clearCurrentPlayer()
window.playerState.getCurrentPlayerId() // → null
```

---

## Task 3: オンボーディング画面 HTML

**Files:**
- Modify: `pingpong-app/index.html` — `screen-auth` の直後に `screen-onboarding` を追加

- [ ] **Step 1: index.html にオンボーディング画面の HTML を追加**

`<!-- 認証画面 -->` の `</div>` の直後（`<!-- ホーム画面 -->` の前）に挿入:

```html
<!-- オンボーディング画面（最初の選手登録） -->
<div class="screen" id="screen-onboarding" style="display:none; flex-direction:column; padding:24px; flex:1;">
  <div style="margin-top:24px; margin-bottom:24px;">
    <h1 style="font-size:22px; font-weight:700; color:#1a1a2e;">選手を登録しましょう</h1>
    <p style="font-size:13px; color:#888; margin-top:6px;">記録する選手の名前と学年を入力してください。後から追加・編集もできます。</p>
  </div>

  <div style="display:flex; flex-direction:column; gap:14px;">
    <div class="form-row">
      <label>名前</label>
      <input id="onboarding-name" type="text" placeholder="例：中田 太郎" required>
    </div>
    <div class="form-row">
      <label>学年</label>
      <select id="onboarding-grade" required>
        <option value="">選択...</option>
        <option value="u10">小学生以下</option>
        <option value="7">小1</option><option value="8">小2</option><option value="9">小3</option>
        <option value="10">小4</option><option value="11">小5</option><option value="12">小6</option>
        <option value="13">中1</option><option value="14">中2</option><option value="15">中3</option>
        <option value="hs">高校・一般</option>
      </select>
    </div>
    <div id="onboarding-message" style="padding:10px; border-radius:8px; display:none; font-size:13px;"></div>
    <button onclick="window.onboarding.submit()" style="margin-top:8px; padding:14px; background:linear-gradient(135deg,#e53935,#c62828); color:#fff; border:none; border-radius:12px; font-weight:700; font-size:15px; cursor:pointer; font-family:inherit;">登録して始める</button>
  </div>
</div>
```

---

## Task 4: onboarding.js (画面制御)

**Files:**
- Create: `pingpong-app/js/onboarding.js`

- [ ] **Step 1: onboarding.js を作成**

```javascript
import * as players from './players.js';
import * as playerState from './player-state.js';

export function showOnboardingScreen() {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    if (s.id !== 'screen-onboarding') s.style.display = 'none';
  });
  const screen = document.getElementById('screen-onboarding');
  screen.style.display = 'flex';
  screen.classList.add('active');
  const fab = document.getElementById('fab');
  if (fab) fab.style.display = 'none';
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'none';
  // フィールド初期化
  document.getElementById('onboarding-name').value = '';
  document.getElementById('onboarding-grade').value = '';
  document.getElementById('onboarding-message').style.display = 'none';
}

export function hideOnboardingScreen() {
  const screen = document.getElementById('screen-onboarding');
  screen.style.display = 'none';
  screen.classList.remove('active');
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'flex';
}

function showMessage(text, isError = false) {
  const el = document.getElementById('onboarding-message');
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = isError ? '#fff5f5' : '#e8f5e9';
  el.style.color = isError ? '#c62828' : '#2e7d32';
}

export async function submit() {
  const name = document.getElementById('onboarding-name').value.trim();
  const grade = document.getElementById('onboarding-grade').value;
  if (!name) return showMessage('名前を入力してください', true);
  if (!grade) return showMessage('学年を選択してください', true);

  try {
    const player = await players.createPlayer({ name, grade });
    playerState.setCurrentPlayerId(player.id);
    hideOnboardingScreen();
    if (typeof window.renderMatches === 'function') window.renderMatches();
    if (typeof window.showScreen === 'function') window.showScreen('home');
  } catch (e) {
    showMessage(e.message || '登録に失敗しました', true);
  }
}

window.onboarding = { submit };
```

- [ ] **Step 2: main.js で読み込む**

```javascript
import * as onboarding from './onboarding.js';
```

---

## Task 5: main.js init フローにオンボーディング判定を組み込む

**Files:**
- Modify: `pingpong-app/js/main.js`

- [ ] **Step 1: main.js を更新**

```javascript
import { supabase } from './supabase-client.js';
import * as auth from './auth.js';
import * as account from './account.js';
import * as authUI from './auth-ui.js';
import * as players from './players.js';
import * as playerState from './player-state.js';
import * as onboarding from './onboarding.js';

window.supabase = supabase;
window.auth = auth;
window.account = account;
window.players = players;
window.playerState = playerState;

async function routeAfterLogin() {
  try {
    await account.getOrCreateAccount();
  } catch (e) {
    console.error('Failed to get account:', e);
  }

  let playerList;
  try {
    playerList = await players.listPlayers();
  } catch (e) {
    console.error('Failed to list players:', e);
    playerList = [];
  }

  if (playerList.length === 0) {
    // 選手未登録 → オンボーディングへ
    onboarding.showOnboardingScreen();
    return;
  }

  // 現在選手が無効な ID または未設定なら最初の選手を選択
  const currentId = playerState.getCurrentPlayerId();
  const validCurrent = playerList.find(p => p.id === currentId);
  if (!validCurrent) {
    playerState.setCurrentPlayerId(playerList[0].id);
  }

  authUI.hideAuthScreen();
  if (typeof window.renderMatches === 'function') window.renderMatches();
  if (typeof window.showScreen === 'function') window.showScreen('home');
}

async function init() {
  const session = await auth.getSession();
  if (session) {
    await routeAfterLogin();
  } else {
    authUI.showAuthScreen();
  }
}

auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    await routeAfterLogin();
  }
  if (event === 'SIGNED_OUT') {
    playerState.clearCurrentPlayer();
    authUI.showAuthScreen();
  }
});

init();
```

- [ ] **Step 2: 動作確認シナリオ**

1. デプロイして動作確認
2. シークレットウィンドウで新規アカウント作成 → ログイン後、オンボーディング画面が表示される
3. 名前と学年を入力 → 「登録して始める」 → ホーム画面に遷移
4. ブラウザリロード → 直接ホーム画面（オンボーディングはスキップされる）
5. ログアウト → ログイン画面 → 同じアカウントでログイン → ホーム画面（オンボーディングはスキップ）
6. Supabase の `players` テーブルでレコードを確認

---

## Task 6: ヘッダー選手切替ドロップダウン

**Files:**
- Modify: `pingpong-app/index.html` — ホーム画面ヘッダーに切替UI用の要素を追加
- Create: `pingpong-app/js/player-ui.js`

- [ ] **Step 1: index.html のホーム画面ヘッダーを更新**

既存のヘッダー部分を、選手名表示用のスペースに：

```html
<div class="header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
  <div style="flex:1; min-width:0;">
    <h1>試合日記</h1>
    <p>2026年 ・ 通算 <span id="total-count">3</span>試合</p>
  </div>
  <div id="player-switcher-mount" style="flex-shrink:0;"></div>
  <button onclick="window.auth && window.auth.signOut()" style="background:none; border:1px solid #e0e0e0; color:#888; font-size:11px; cursor:pointer; padding:6px 10px; border-radius:8px; font-family:inherit; flex-shrink:0;">ログアウト</button>
</div>
```

(`#player-switcher-mount` の div を新たに挿入。既存のログアウトボタンはそのまま)

- [ ] **Step 2: player-ui.js を作成**

```javascript
import * as players from './players.js';
import * as playerState from './player-state.js';

let playerListCache = [];
let dropdownOpen = false;

export async function refreshSwitcher() {
  try {
    playerListCache = await players.listPlayers();
  } catch (e) {
    console.error('Failed to refresh players:', e);
    playerListCache = [];
  }
  renderSwitcher();
}

function renderSwitcher() {
  const mount = document.getElementById('player-switcher-mount');
  if (!mount) return;

  if (playerListCache.length <= 1) {
    mount.innerHTML = '';
    return;
  }

  const currentId = playerState.getCurrentPlayerId();
  const current = playerListCache.find(p => p.id === currentId) || playerListCache[0];
  const initial = (current.name || '?')[0];

  mount.innerHTML = `
    <button onclick="window.playerUI.toggleDropdown()" style="background:#f5f5f5; border:none; border-radius:20px; padding:6px 12px; display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit;">
      <span style="width:22px; height:22px; background:linear-gradient(135deg,#1a1a2e,#e53935); border-radius:50%; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0;">${initial}</span>
      <span style="max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${current.name}</span>
      <span style="color:#aaa; font-size:10px;">▼</span>
    </button>
    <div id="player-dropdown" style="display:${dropdownOpen ? 'block' : 'none'}; position:absolute; right:20px; top:60px; background:#fff; border:1px solid #eee; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.1); z-index:50; min-width:180px; overflow:hidden;">
      ${playerListCache.map(p => `
        <button onclick="window.playerUI.selectPlayer('${p.id}')" style="display:flex; align-items:center; gap:10px; width:100%; padding:12px 14px; background:${p.id === current.id ? '#fff5f5' : '#fff'}; border:none; border-bottom:1px solid #f5f5f5; text-align:left; font-size:13px; cursor:pointer; font-family:inherit;">
          <span style="width:22px; height:22px; background:linear-gradient(135deg,#1a1a2e,#e53935); border-radius:50%; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0;">${(p.name || '?')[0]}</span>
          <span style="flex:1;">${p.name}</span>
          ${p.id === current.id ? '<span style="color:#e53935; font-size:11px;">●</span>' : ''}
        </button>
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
  // Task 7 で実装するモーダルを開く
  if (window.playerEdit) window.playerEdit.openAdd();
}

// 外側クリックでドロップダウンを閉じる
document.addEventListener('click', (e) => {
  if (!dropdownOpen) return;
  const mount = document.getElementById('player-switcher-mount');
  if (mount && !mount.contains(e.target)) {
    dropdownOpen = false;
    renderSwitcher();
  }
});

window.playerUI = { toggleDropdown, selectPlayer, openAddPlayer, refreshSwitcher };
```

- [ ] **Step 3: main.js でロード**

```javascript
import * as playerUI from './player-ui.js';
window.playerUI = playerUI;
```

そして `routeAfterLogin` の最後に `playerUI.refreshSwitcher()` を呼ぶ：

```javascript
authUI.hideAuthScreen();
await playerUI.refreshSwitcher();
if (typeof window.renderMatches === 'function') window.renderMatches();
if (typeof window.showScreen === 'function') window.showScreen('home');
```

そして onboarding.js の submit 成功後にも `playerUI.refreshSwitcher()` を呼ぶ：

```javascript
// onboarding.js submit() の後半を修正
playerState.setCurrentPlayerId(player.id);
hideOnboardingScreen();
if (window.playerUI) await window.playerUI.refreshSwitcher();
if (typeof window.renderMatches === 'function') window.renderMatches();
if (typeof window.showScreen === 'function') window.showScreen('home');
```

- [ ] **Step 4: 動作確認**

1. シークレットで2つの選手を作るシナリオ：
   - 新規アカウント作成 → オンボーディングで選手1人登録 → ホーム画面
   - 1人だけだとヘッダーに切替UIが**出ない**ことを確認
   - DevTools コンソールで2人目を追加: `await window.players.createPlayer({ name: '次郎', grade: '11' })`
   - `await window.playerUI.refreshSwitcher()` で更新
   - ヘッダーに「太郎 ▼」のボタンが表示されることを確認
   - タップ → ドロップダウン展開 → 「次郎」をタップ → 「次郎 ▼」に切り替わることを確認
   - localStorage の `pingpong_current_player_id` が更新されていること

---

## Task 7: 選手追加・編集モーダル

**Files:**
- Modify: `pingpong-app/index.html` — モーダル要素追加
- Create: `pingpong-app/js/player-edit.js`

- [ ] **Step 1: index.html にモーダルを追加**

既存の `<!-- 記録確認モーダル -->` の直後に追加:

```html
<!-- 選手追加・編集モーダル -->
<div class="modal-overlay" id="player-edit-modal">
  <div class="modal" id="player-edit-content"></div>
</div>
```

- [ ] **Step 2: player-edit.js を作成**

```javascript
import * as players from './players.js';
import * as playerState from './player-state.js';

let editingId = null; // null = 新規追加、それ以外は編集対象 id

const HAND_OPTIONS = ['', '右利き', '左利き'];
const TYPE_OPTIONS = ['', 'シェークハンド裏裏', 'ペンホルダー', 'フォア表', 'バック表', 'バック粒高', 'ペン粒', 'カットマン（粒高）', 'カットマン（表）', 'その他'];
const GRADE_OPTIONS = [
  ['u10', '小学生以下'],
  ['7', '小1'], ['8', '小2'], ['9', '小3'],
  ['10', '小4'], ['11', '小5'], ['12', '小6'],
  ['13', '中1'], ['14', '中2'], ['15', '中3'],
  ['hs', '高校・一般'],
];

function render(player = null) {
  const isEdit = !!player;
  const grade = player?.grade || '';
  const hand = player?.hand || '';
  const type = player?.play_type || '';
  document.getElementById('player-edit-content').innerHTML = `
    <div class="modal-header" style="margin-bottom:14px;">
      <div class="modal-title">${isEdit ? '選手を編集' : '選手を追加'}</div>
      <div class="modal-close" onclick="playerEdit.close()">×</div>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-row">
        <label>名前</label>
        <input id="player-edit-name" type="text" value="${player?.name || ''}" placeholder="例：中田 太郎">
      </div>
      <div class="form-row">
        <label>学年</label>
        <select id="player-edit-grade">
          <option value="">選択...</option>
          ${GRADE_OPTIONS.map(([v, l]) => `<option value="${v}"${v === grade ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>利き手（任意）</label>
        <select id="player-edit-hand">
          ${HAND_OPTIONS.map(h => `<option value="${h}"${h === hand ? ' selected' : ''}>${h || '未設定'}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>戦型（任意）</label>
        <select id="player-edit-type">
          ${TYPE_OPTIONS.map(t => `<option value="${t}"${t === type ? ' selected' : ''}>${t || '未設定'}</option>`).join('')}
        </select>
      </div>
      <div id="player-edit-message" style="padding:10px; border-radius:8px; display:none; font-size:13px;"></div>
      <div style="display:flex; gap:10px; margin-top:8px;">
        ${isEdit ? '<button onclick="playerEdit.handleDelete()" style="flex:1; padding:14px; background:#fff5f5; color:#e53935; border:1.5px solid #ffcdd2; border-radius:12px; font-weight:700; cursor:pointer; font-family:inherit;">削除</button>' : ''}
        <button onclick="playerEdit.handleSave()" style="flex:${isEdit ? '2' : '1'}; padding:14px; background:linear-gradient(135deg,#e53935,#c62828); color:#fff; border:none; border-radius:12px; font-weight:700; cursor:pointer; font-family:inherit;">保存</button>
      </div>
    </div>
  `;
}

function showMessage(text, isError = false) {
  const el = document.getElementById('player-edit-message');
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = isError ? '#fff5f5' : '#e8f5e9';
  el.style.color = isError ? '#c62828' : '#2e7d32';
}

export function openAdd() {
  editingId = null;
  render(null);
  document.getElementById('player-edit-modal').classList.add('show');
}

export function openEdit(player) {
  editingId = player.id;
  render(player);
  document.getElementById('player-edit-modal').classList.add('show');
}

export function close() {
  document.getElementById('player-edit-modal').classList.remove('show');
  editingId = null;
}

export async function handleSave() {
  const name = document.getElementById('player-edit-name').value.trim();
  const grade = document.getElementById('player-edit-grade').value;
  const hand = document.getElementById('player-edit-hand').value || null;
  const play_type = document.getElementById('player-edit-type').value || null;
  if (!name) return showMessage('名前を入力してください', true);
  if (!grade) return showMessage('学年を選択してください', true);

  try {
    if (editingId) {
      await players.updatePlayer(editingId, { name, grade, hand, play_type });
    } else {
      const created = await players.createPlayer({ name, grade, hand, play_type });
      // 新規追加した選手を current にする
      playerState.setCurrentPlayerId(created.id);
    }
    close();
    if (window.playerUI) await window.playerUI.refreshSwitcher();
    if (typeof window.renderMatches === 'function') window.renderMatches();
  } catch (e) {
    showMessage(e.message || '保存に失敗しました', true);
  }
}

export async function handleDelete() {
  if (!editingId) return;
  if (!confirm('この選手を削除しますか？関連する試合データも削除されます（現状はローカルのみ・Phase 1Dまで）。')) return;
  try {
    await players.deletePlayer(editingId);
    // current が削除した選手なら別の選手に切り替え
    if (playerState.getCurrentPlayerId() === editingId) {
      const remaining = await players.listPlayers();
      playerState.setCurrentPlayerId(remaining[0]?.id || null);
    }
    close();
    if (window.playerUI) await window.playerUI.refreshSwitcher();
    if (typeof window.renderMatches === 'function') window.renderMatches();
  } catch (e) {
    showMessage(e.message || '削除に失敗しました', true);
  }
}

window.playerEdit = { openAdd, openEdit, close, handleSave, handleDelete };
```

- [ ] **Step 3: main.js でロード**

```javascript
import * as playerEdit from './player-edit.js';
window.playerEdit = playerEdit;
```

- [ ] **Step 4: モーダル外クリックで閉じるイベント追加（index.html の既存 `<script>` の最下部）**

既存の他モーダルクローズハンドラの近くに追加：

```javascript
document.getElementById('player-edit-modal').addEventListener('click', function(e) {
  if (e.target === this) {
    if (window.playerEdit) window.playerEdit.close();
  }
});
```

- [ ] **Step 5: 動作確認**

1. ヘッダーの選手切替ドロップダウン → 「＋ 選手を追加」をタップ
2. モーダルが開く → 名前と学年を入力 → 「保存」 → モーダル閉じる、新選手がアクティブになる
3. ドロップダウンに新選手が表示される
4. （次のステップで編集機能の起点を作る）

---

## Task 8: 既存選手の編集導線追加（ドロップダウンに鉛筆ボタン）

**Files:**
- Modify: `pingpong-app/js/player-ui.js` — ドロップダウン項目に編集ボタン追加

- [ ] **Step 1: player-ui.js の renderSwitcher 内ループを更新**

ドロップダウンの各 player ボタン横に編集アイコン追加：

```javascript
// renderSwitcher 内、playerListCache.map(...) を以下に置換
${playerListCache.map(p => `
  <div style="display:flex; align-items:stretch; border-bottom:1px solid #f5f5f5; background:${p.id === current.id ? '#fff5f5' : '#fff'};">
    <button onclick="window.playerUI.selectPlayer('${p.id}')" style="flex:1; display:flex; align-items:center; gap:10px; padding:12px 14px; background:none; border:none; text-align:left; font-size:13px; cursor:pointer; font-family:inherit;">
      <span style="width:22px; height:22px; background:linear-gradient(135deg,#1a1a2e,#e53935); border-radius:50%; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0;">${(p.name || '?')[0]}</span>
      <span style="flex:1;">${p.name}</span>
      ${p.id === current.id ? '<span style="color:#e53935; font-size:11px;">●</span>' : ''}
    </button>
    <button onclick="window.playerUI.editPlayer('${p.id}')" style="padding:0 14px; background:none; border:none; color:#888; cursor:pointer; font-size:14px;">✎</button>
  </div>
`).join('')}
```

- [ ] **Step 2: player-ui.js に editPlayer 関数を追加**

```javascript
export function editPlayer(id) {
  const player = playerListCache.find(p => p.id === id);
  if (!player) return;
  dropdownOpen = false;
  renderSwitcher();
  if (window.playerEdit) window.playerEdit.openEdit(player);
}
```

そして `window.playerUI` に追加：

```javascript
window.playerUI = { toggleDropdown, selectPlayer, openAddPlayer, refreshSwitcher, editPlayer };
```

- [ ] **Step 3: 動作確認**

1. 2人選手のいる状態でドロップダウン展開
2. 各選手の右側に「✎」ボタン → タップ → 編集モーダル開く
3. 学年や利き手を変更 → 保存 → ドロップダウン更新

---

## Task 9: デプロイと最終検証

- [ ] **Step 1: Vercel にデプロイ**

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
vercel --prod --yes
```

- [ ] **Step 2: 新規ユーザーのフルフロー検証**

1. シークレットウィンドウで `https://pingpong-app-one.vercel.app` を開く
2. 「Google で続ける」で新規ログイン
3. オンボーディング画面が表示される
4. 名前と学年を入力 → 「登録して始める」
5. ホーム画面に遷移、ヘッダーには選手1人なので切替UI表示なし

- [ ] **Step 3: 兄弟（複数選手）シナリオ**

1. ホーム画面で何らかの方法で「選手を追加」を起動
   - ※選手が1人のときはドロップダウンが出ないので、一時的に DevTools コンソールから `window.playerEdit.openAdd()` を実行して追加可能
   - ※将来は「設定画面」を作って追加導線を設置（このプランでは省略、Phase 1B 完了条件に含めない）
2. 2人目の選手「次郎」を追加
3. ヘッダーに切替ドロップダウンが出現することを確認
4. 切替 → 表示が「次郎」に変わる
5. 編集 → 名前変更 → 保存 → 反映される
6. 削除 → 「次郎」が消える、「太郎」のみに戻り、切替UIも消える

- [ ] **Step 4: ログアウト・再ログイン検証**

1. ログアウト
2. 同じアカウントでログイン → オンボーディングはスキップされ、直接ホーム画面に遷移
3. ヘッダーの選手表示が前回選択中の人になっていること

- [ ] **Step 5: Supabase で永続性確認**

`https://supabase.com/dashboard/project/mxxajbziopkgjktccotg/editor` で `players` テーブル → 全ての選手レコードが見えること、`account_id` が正しいこと、削除後も他人の選手は触れていないこと。

---

## 完了条件（Phase 1B の Definition of Done）

- [ ] 新規ログイン後、選手未登録ならオンボーディング画面が出る
- [ ] オンボーディングで名前+学年を入力して登録できる
- [ ] 既存ユーザー（選手登録済み）はオンボーディングをスキップしてホームに遷移
- [ ] 選手1人のアカウントではヘッダーに切替UIが出ない
- [ ] 選手2人以上のアカウントではヘッダーに切替ドロップダウンが出る
- [ ] ドロップダウンから選手を切替できる
- [ ] ドロップダウンから新規選手を追加できる
- [ ] ドロップダウンから既存選手を編集・削除できる
- [ ] 現在選手は localStorage で端末ローカルに保持され、リロード後も維持される
- [ ] ログアウトで現在選手はクリアされる
- [ ] Supabase の players テーブルにレコードが正しく保存される

---

## 注意点・既知の制約

- **このフェーズの時点で試合データはまだ localStorage に保存され、player_id とは紐付かない。** ヘッダーで選手を切替えても表示される試合データは変わらない（全 localStorage 試合が表示される）。これは Phase 1D で解消する。
- 「設定画面」を作って選手追加・編集の独立した導線を作るのは Phase 1B のスコープ外。現状はヘッダーの切替ドロップダウン経由のみ。1人時は DevTools か、後の設計判断（例：オンボーディング後に「もう一人追加しますか？」を表示）で対応予定。
- 削除モーダルは confirm() ダイアログで簡易対応。本格的なポップアップは Phase 1D で試合削除と同等のスタイルに統一。

---

## 次のフェーズ

- **Phase 1C**: Data layer（Supabase wrapper、IndexedDB、sync queue）
- **Phase 1D**: Match / AddressBook の Cloud CRUD（player_id 連動も含む）
- **Phase 1E**: localStorage migration UI
