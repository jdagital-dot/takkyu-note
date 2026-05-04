# Cloud Phase 1A: Auth Foundation 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase バックエンドをセットアップし、ユーザーがメール+パスワード／Google／Apple でサインアップ・ログインできる状態にする。

**Architecture:**
- 既存の `pingpong-app/index.html` に Supabase Auth を統合
- 新規モジュール（ES modules）として `js/` 配下に auth ロジックを切り出し
- データベースは Supabase 上に schema + RLS ポリシーをSQL投入で構築
- 認証成功後、`accounts` テーブルに対応行が作られる（無ければ作成）

**Tech Stack:** Supabase (PostgreSQL + Auth)、`@supabase/supabase-js` v2 (CDN ESM)、Vanilla JS ES modules

**Spec:** `docs/superpowers/specs/2026-04-25-cloud-phase-1-design.md`

**スコープ:** このプランは Phase 1 の最初の段階。完了時点で「ログイン後ホーム画面が表示される（試合機能はまだ既存のlocalStorageベースで動く）」状態になる。Player 管理・データ層は Phase 1B 以降。

---

## ファイル構成

### 新規作成
- `pingpong-app/js/supabase-client.js` — Supabase クライアント初期化
- `pingpong-app/js/auth.js` — Auth 操作（signup/login/logout/getSession）
- `pingpong-app/js/auth-ui.js` — ログイン/サインアップ画面のUI制御
- `pingpong-app/js/account.js` — accounts テーブルのCRUD（getOrCreate）
- `pingpong-app/sql/01-schema.sql` — DBスキーマ定義
- `pingpong-app/sql/02-rls.sql` — Row Level Security ポリシー

### 修正
- `pingpong-app/index.html` — ログイン画面の追加、起動時の認証チェック追加
- `pingpong-app/sw.js` — Supabase ドメインを fetch handler から除外

---

## Task 1: Supabase プロジェクトのセットアップ

**手動操作タスク。** 宮本さんが実施し、結果（URL/anon key）を記録する。

- [ ] **Step 1: Supabase アカウント作成・ログイン**

ブラウザで https://supabase.com/dashboard にアクセス。GitHub または Google アカウントでサインアップ。

- [ ] **Step 2: 新規プロジェクト作成**

「New Project」をクリック。
- Organization: 個人組織を選択
- Name: `pingpong-app`
- Database password: 強固なパスワードを生成し、1Password等に保存
- Region: `Northeast Asia (Tokyo)` を選択
- Pricing Plan: Free
- 「Create new project」→ 約2分待つ

- [ ] **Step 3: API URL と anon key を取得**

プロジェクト作成完了後、左メニュー「Project Settings」→「API」を開く。
- `Project URL`（`https://xxxxx.supabase.co`）
- `anon` `public` キー（`eyJhbGc...` で始まる長い文字列）

これらを `pingpong-app/.env.local` に保存（git管理しない）：
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

> anon key は公開されても安全（RLSが守る）。だが整理のため別ファイルにする。

---

## Task 2: データベーススキーマ作成

**Files:**
- Create: `pingpong-app/sql/01-schema.sql`

- [ ] **Step 1: schema.sql を作成**

```sql
-- accounts: ログインユーザーのプロファイル
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'individual',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- players: 記録対象の選手（1アカウントが複数持てる）
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  grade text,
  hand text,
  play_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_players_account ON players(account_id);

-- matches: 試合記録
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  opponent_name text,
  opponent_team text,
  opponent_age int,
  opponent_pref text,
  opponent_hand text,
  opponent_type text,
  match_type text,
  score text,
  win boolean,
  tags jsonb DEFAULT '[]'::jsonb,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_matches_player ON matches(player_id);

-- opponents: アドレス帳
CREATE TABLE IF NOT EXISTS opponents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  team text,
  age int,
  pref text,
  hand text,
  type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opponents_account ON opponents(account_id);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: Supabase で SQL を実行**

Supabase Dashboard → 左メニュー「SQL Editor」→「New query」→ 上記SQLを貼り付け→「Run」。

- [ ] **Step 3: テーブルが作成されたことを確認**

「Table Editor」→ 4テーブル（accounts, players, matches, opponents）が表示されることを確認。

---

## Task 3: Row Level Security ポリシー

**Files:**
- Create: `pingpong-app/sql/02-rls.sql`

- [ ] **Step 1: rls.sql を作成**

```sql
-- すべてのテーブルでRLSを有効化
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponents ENABLE ROW LEVEL SECURITY;

-- accounts: 自分のレコードだけ読み書きできる
CREATE POLICY "users select own account" ON accounts
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "users insert own account" ON accounts
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users update own account" ON accounts
  FOR UPDATE USING (id = auth.uid());

-- players: 自分のアカウントの選手だけ
CREATE POLICY "users access own players" ON players
  FOR ALL USING (account_id = auth.uid());

-- matches: 自分の選手の試合だけ
CREATE POLICY "users access own matches" ON matches
  FOR ALL USING (
    player_id IN (SELECT id FROM players WHERE account_id = auth.uid())
  );

-- opponents: 自分のアカウントのアドレス帳だけ
CREATE POLICY "users access own opponents" ON opponents
  FOR ALL USING (account_id = auth.uid());
```

- [ ] **Step 2: SQL を実行**

SQL Editor で実行。

- [ ] **Step 3: 確認**

Table Editor → 各テーブルの「RLS enabled」アイコン（盾マーク）が緑色になっていることを確認。

---

## Task 4: Supabase Auth プロバイダ設定

**手動操作タスク。**

- [ ] **Step 1: メール+パスワードを有効化（デフォルト有効）**

Authentication → Providers → Email → 「Enable Email Provider」が ON になっていることを確認。
「Confirm email」を **ON** に設定（メール確認必須）。

- [ ] **Step 2: メールテンプレート設定**

Authentication → Email Templates → 「Confirm signup」を選択。
日本語に書き換え：
```
件名: 卓球記録ノート - メールアドレスの確認

本文:
卓球記録ノートにご登録いただきありがとうございます。

下記のリンクをクリックしてメールアドレスを確認してください：

{{ .ConfirmationURL }}

このリンクは24時間有効です。
```

- [ ] **Step 3: Site URL を設定**

Authentication → URL Configuration:
- Site URL: `https://pingpong-app-one.vercel.app`
- Redirect URLs: `https://pingpong-app-one.vercel.app/**` を追加

- [ ] **Step 4: Google OAuth 設定**

Google Cloud Console (https://console.cloud.google.com/) で：
1. プロジェクト作成（既存でも可）
2. 「APIs & Services」→「Credentials」→「Create Credentials」→「OAuth client ID」
3. Application type: Web application
4. Authorized redirect URIs: `https://xxxxx.supabase.co/auth/v1/callback`（自分のSupabase URL）
5. Client ID と Client Secret を取得

Supabase に戻り、Authentication → Providers → Google を有効化、Client ID と Secret を入力、保存。

- [ ] **Step 5: Apple OAuth 設定（後回し可・iOSユーザー多い場合に必須）**

Apple Developer アカウント（年$99）が必要。詳細手順は Supabase ドキュメント参照：
https://supabase.com/docs/guides/auth/social-login/auth-apple

> 開発初期はGoogleのみで進めて、後で追加でも良い。

---

## Task 5: Supabase クライアントモジュール

**Files:**
- Create: `pingpong-app/js/supabase-client.js`

- [ ] **Step 1: supabase-client.js を作成**

```javascript
// pingpong-app/js/supabase-client.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 注: anon key は公開されてもRLSが守るため、ここに直接書いてOK
const SUPABASE_URL = '<<TODO: Task 1 で取得した URL>>';
const SUPABASE_ANON_KEY = '<<TODO: Task 1 で取得した anon key>>';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
```

- [ ] **Step 2: index.html で読み込めるようにする**

`pingpong-app/index.html` の `<script>` タグの直前に以下を追加（既存スクリプトより前に読み込む必要があるため）：

```html
<script type="module" src="/js/main.js"></script>
```

そして `pingpong-app/js/main.js` を新規作成（後続タスクで中身を埋める）：
```javascript
// pingpong-app/js/main.js
import { supabase } from './supabase-client.js';
window.supabase = supabase; // 既存の非モジュールコードからもアクセスできるように
console.log('Supabase client loaded', supabase);
```

- [ ] **Step 3: ローカル動作確認**

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開き、DevTools コンソールに `Supabase client loaded` が出ること、エラーが無いことを確認。

- [ ] **Step 4: Vercel デプロイして本番でも動作確認**

```bash
vercel --prod --yes
```

`https://pingpong-app-one.vercel.app` を開いてコンソール確認。

---

## Task 6: Auth モジュール（signup/login/logout/getSession）

**Files:**
- Create: `pingpong-app/js/auth.js`

- [ ] **Step 1: auth.js を作成**

```javascript
// pingpong-app/js/auth.js
import { supabase } from './supabase-client.js';

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + '/',
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/' },
  });
  if (error) throw error;
  return data;
}

export async function signInWithApple() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: window.location.origin + '/' },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}

export async function resendConfirmationEmail(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}
```

- [ ] **Step 2: main.js で auth を読み込む**

```javascript
// pingpong-app/js/main.js
import { supabase } from './supabase-client.js';
import * as auth from './auth.js';

window.supabase = supabase;
window.auth = auth;
console.log('Auth module loaded');
```

- [ ] **Step 3: 動作確認（コンソール）**

DevTools コンソールで実行：
```javascript
await window.auth.getSession() // → null（未ログイン）
```

---

## Task 7: account.js（アカウントの自動作成）

**Files:**
- Create: `pingpong-app/js/account.js`

- [ ] **Step 1: account.js を作成**

```javascript
// pingpong-app/js/account.js
import { supabase } from './supabase-client.js';

/**
 * 現在ログイン中のユーザーの accounts レコードを取得。無ければ作成する。
 */
export async function getOrCreateAccount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 既存レコード確認
  const { data: existing, error: selectError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;

  // 無ければ作成
  const { data: created, error: insertError } = await supabase
    .from('accounts')
    .insert({
      id: user.id,
      email: user.email,
      role: 'individual',
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return created;
}

export async function updateAccount(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: main.js に追加**

```javascript
import * as account from './account.js';
window.account = account;
```

---

## Task 8: ログイン／サインアップ UI 実装

**Files:**
- Create: `pingpong-app/js/auth-ui.js`
- Modify: `pingpong-app/index.html`（ログイン画面のHTMLを追加）

- [ ] **Step 1: index.html にログイン画面の HTML を追加**

`<div class="phone">` の中、既存の `<!-- ホーム画面 -->` の前に挿入：

```html
<!-- 認証画面（未ログイン時のみ表示） -->
<div class="screen" id="screen-auth" style="display:none; flex-direction:column; padding:24px; justify-content:center;">
  <div style="text-align:center; margin-bottom:32px;">
    <div style="width:80px; height:80px; margin:0 auto 16px; background:#1a1a2e; border-radius:20px; display:flex; align-items:center; justify-content:center;">
      <div style="width:48px; height:48px; background:#e53935; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px; font-weight:800;">卓</div>
    </div>
    <h1 style="font-size:22px; font-weight:700; color:#1a1a2e;">卓球記録ノート</h1>
    <p style="font-size:13px; color:#888; margin-top:6px;">試合記録と分析がスマホで完結</p>
  </div>

  <div id="auth-form-container">
    <!-- auth-ui.js が中身を描画 -->
  </div>

  <div id="auth-message" style="margin-top:16px; padding:12px; border-radius:10px; display:none; font-size:13px;"></div>
</div>
```

- [ ] **Step 2: auth-ui.js を作成**

```javascript
// pingpong-app/js/auth-ui.js
import * as auth from './auth.js';

let mode = 'login'; // 'login' | 'signup' | 'verify-sent'

export function showAuthScreen() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const authScreen = document.getElementById('screen-auth');
  authScreen.style.display = 'flex';
  authScreen.classList.add('active');
  document.getElementById('fab').style.display = 'none';
  document.querySelector('.bottom-nav').style.display = 'none';
  renderAuthForm();
}

export function hideAuthScreen() {
  const authScreen = document.getElementById('screen-auth');
  authScreen.style.display = 'none';
  authScreen.classList.remove('active');
  document.querySelector('.bottom-nav').style.display = 'flex';
}

function renderAuthForm() {
  const container = document.getElementById('auth-form-container');
  if (mode === 'verify-sent') {
    container.innerHTML = `
      <div style="text-align:center; padding:24px; background:#f9f9f9; border-radius:14px;">
        <div style="font-size:18px; font-weight:700; color:#1a1a2e; margin-bottom:8px;">確認メールを送りました</div>
        <div style="font-size:13px; color:#888; line-height:1.6;">メールアプリを開いて、リンクをクリックしてください。</div>
        <button onclick="authUI.setMode('login')" style="margin-top:16px; background:none; border:none; color:#e53935; font-weight:700; cursor:pointer;">ログイン画面に戻る</button>
      </div>
    `;
    return;
  }

  const isLogin = mode === 'login';
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <button onclick="authUI.handleGoogle()" style="padding:14px; background:#fff; border:1.5px solid #ddd; border-radius:12px; font-weight:600; font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
        Google で続ける
      </button>
      <button onclick="authUI.handleApple()" style="padding:14px; background:#000; color:#fff; border:none; border-radius:12px; font-weight:600; font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
         Apple で続ける
      </button>
      <div style="display:flex; align-items:center; gap:12px; margin:8px 0; color:#aaa; font-size:12px;">
        <div style="flex:1; height:1px; background:#eee;"></div>
        または
        <div style="flex:1; height:1px; background:#eee;"></div>
      </div>
      <input id="auth-email" type="email" placeholder="メールアドレス" style="padding:12px 14px; border:1.5px solid #e0e0e0; border-radius:10px; font-size:16px; outline:none;">
      <input id="auth-password" type="password" placeholder="パスワード（6文字以上）" style="padding:12px 14px; border:1.5px solid #e0e0e0; border-radius:10px; font-size:16px; outline:none;">
      <button onclick="authUI.${isLogin ? 'handleLogin' : 'handleSignup'}()" style="padding:14px; background:linear-gradient(135deg,#e53935,#c62828); color:#fff; border:none; border-radius:12px; font-weight:700; font-size:15px; cursor:pointer;">
        ${isLogin ? 'ログイン' : '新規登録'}
      </button>
      <button onclick="authUI.setMode('${isLogin ? 'signup' : 'login'}')" style="padding:8px; background:none; border:none; color:#666; font-size:13px; cursor:pointer; text-decoration:underline;">
        ${isLogin ? '新規登録はこちら' : 'すでにアカウントをお持ちの方'}
      </button>
    </div>
  `;
}

function showMessage(text, isError = false) {
  const el = document.getElementById('auth-message');
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = isError ? '#fff5f5' : '#e8f5e9';
  el.style.color = isError ? '#c62828' : '#2e7d32';
}

function setMode(newMode) {
  mode = newMode;
  document.getElementById('auth-message').style.display = 'none';
  renderAuthForm();
}

async function handleSignup() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) return showMessage('メールとパスワードを入力してください', true);
  try {
    await auth.signUpWithEmail(email, password);
    setMode('verify-sent');
  } catch (e) {
    showMessage(translateError(e.message), true);
  }
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) return showMessage('メールとパスワードを入力してください', true);
  try {
    await auth.signInWithEmail(email, password);
    // onAuthStateChange が発火して画面遷移
  } catch (e) {
    showMessage(translateError(e.message), true);
  }
}

async function handleGoogle() {
  try { await auth.signInWithGoogle(); } catch (e) { showMessage(e.message, true); }
}

async function handleApple() {
  try { await auth.signInWithApple(); } catch (e) { showMessage(e.message, true); }
}

function translateError(msg) {
  if (msg.includes('Invalid login credentials')) return 'メールまたはパスワードが間違っています';
  if (msg.includes('Email not confirmed')) return 'メール確認が完了していません。受信メールのリンクをクリックしてください';
  if (msg.includes('User already registered')) return 'このメールは既に登録されています';
  if (msg.includes('Password should be at least 6')) return 'パスワードは6文字以上にしてください';
  return msg;
}

window.authUI = { setMode, handleSignup, handleLogin, handleGoogle, handleApple };
```

- [ ] **Step 3: main.js から auth-ui を呼ぶ**

```javascript
// pingpong-app/js/main.js
import { supabase } from './supabase-client.js';
import * as auth from './auth.js';
import * as account from './account.js';
import * as authUI from './auth-ui.js';

window.supabase = supabase;
window.auth = auth;
window.account = account;

async function init() {
  const session = await auth.getSession();
  if (session) {
    // ログイン済み: アカウント作成 → ホーム画面表示
    await account.getOrCreateAccount();
    authUI.hideAuthScreen();
    // 既存の renderMatches() などをそのまま動かす
    if (typeof window.renderMatches === 'function') window.renderMatches();
  } else {
    authUI.showAuthScreen();
  }
}

// 認証状態変化を監視
auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    await account.getOrCreateAccount();
    authUI.hideAuthScreen();
    if (typeof window.renderMatches === 'function') window.renderMatches();
  }
  if (event === 'SIGNED_OUT') {
    authUI.showAuthScreen();
  }
});

init();
```

- [ ] **Step 4: index.html の既存 `<script>` で `renderMatches` を `window` に公開**

既存の `<script>` 末尾近くの `renderMatches();` `initSets();` を、最初の認証チェックで呼ばれるよう修正：

```javascript
window.renderMatches = renderMatches;
// renderMatches();  ← 最初の自動実行をやめる（main.js の init から呼ばれる）
initSets();
```

> 既存ロジックはそのまま温存。main.js の init() でログイン済みなら呼ばれる。

---

## Task 9: ログアウトボタン追加

**Files:**
- Modify: `pingpong-app/index.html`（一時的に簡易ログアウトボタン）

- [ ] **Step 1: index.html のヘッダーに一時的なログアウトボタンを追加**

これは Phase 1B でヘッダーのドロップダウンに移すので一時的。

`screen-home` のヘッダー右上に追加：
```html
<div class="header" style="display:flex; justify-content:space-between; align-items:flex-start;">
  <div>
    <h1>試合日記</h1>
    <p>2026年 ・ 通算 <span id="total-count">3</span>試合</p>
  </div>
  <button onclick="window.auth.signOut()" style="background:none; border:none; color:#888; font-size:12px; cursor:pointer; padding:4px 8px;">ログアウト</button>
</div>
```

---

## Task 10: Service Worker の調整

**Files:**
- Modify: `pingpong-app/sw.js`

Supabase の API リクエストを Service Worker のキャッシュ対象から除外。これをしないと OAuth コールバック等が壊れる可能性がある。

- [ ] **Step 1: sw.js の fetch handler を修正**

```javascript
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Supabase API、Google、Appleへのリクエストはキャッシュせず素通し
  if (url.hostname.endsWith('.supabase.co') ||
      url.hostname.includes('google') ||
      url.hostname.includes('apple')) {
    return; // デフォルト（fetch）
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
```

- [ ] **Step 2: CACHE バージョンを上げる**

```javascript
const CACHE = 'pingpong-v2'; // v1 → v2
```

---

## Task 11: デプロイと統合検証

- [ ] **Step 1: Vercel にデプロイ**

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
vercel --prod --yes
```

- [ ] **Step 2: メール+パスワードのサインアップ検証**

1. `https://pingpong-app-one.vercel.app` をシークレットウィンドウで開く
2. ログイン画面が表示されることを確認
3. 「新規登録はこちら」→ 適当なメール（自分のテスト用）+ パスワード（6文字以上）→ 「新規登録」
4. 「確認メールを送りました」画面が表示される
5. 受信メールのリンクをクリック
6. アプリにリダイレクトされ、ホーム画面が表示される
7. Supabase Dashboard → Authentication → Users に新規ユーザーが現れること
8. Table Editor → accounts に対応行が作られていること

- [ ] **Step 3: ログアウト＆再ログイン検証**

1. 「ログアウト」をタップ
2. ログイン画面に戻る
3. 同じメールとパスワードで「ログイン」
4. ホーム画面に戻る

- [ ] **Step 4: Google ログイン検証**

1. シークレットウィンドウで開く
2. 「Google で続ける」をタップ
3. Google 認証画面 → 同意
4. アプリに戻り、ホーム画面が表示される
5. accounts テーブルに新規行が追加されていること

- [ ] **Step 5: 無効ログインのエラー表示**

1. ログアウト → 間違ったパスワードでログイン
2. 「メールまたはパスワードが間違っています」と表示されること

- [ ] **Step 6: メール未確認状態でのログイン拒否**

1. シークレットで新規メール登録 → 確認メールを開かずに、別のシークレットで同じメール+パスワードでログイン
2. 「メール確認が完了していません」と表示されること

- [ ] **Step 7: RLS 確認（重要）**

1. アカウントAでログイン → DevTools コンソールで以下を実行
   ```javascript
   await window.supabase.from('accounts').select('*')
   // → 自分の accounts 行だけが返る（他のユーザーは見えない）
   ```
2. アカウントAでログイン中に、適当な uuid を渡して取得を試みる
   ```javascript
   await window.supabase.from('accounts').select('*').eq('id', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
   // → 空の配列が返る（RLSが守る）
   ```

---

## 完了条件（Phase 1A の Definition of Done）

- [ ] メール+パスワードで新規登録 → 確認メール → ログインできる
- [ ] Google で新規登録・ログインできる
- [ ] Apple で新規登録・ログインできる（Apple Developer 登録後）
- [ ] ログイン状態がブラウザリロード後も維持される
- [ ] ログアウトできる
- [ ] accounts テーブルに自動でレコードが作られる
- [ ] RLS で他人のデータが見えないことを確認した
- [ ] 既存の試合記録機能（localStorage ベース）はログイン後も動作する
- [ ] コンソールエラーが出ない

---

## 注意点・既知の制約

- **このフェーズの時点で試合データはまだ localStorage に保存される。** Supabase への保存は Phase 1D で実装。
- Apple ログインは Apple Developer ($99/年) 必要。優先度低ければ Phase 1A スコープ外でも可。
- Email Confirmation メールが届かない場合、Supabase の SMTP 設定を確認（無料枠は1時間4通制限あり）。本番運用では Resend や SendGrid に切替推奨。
- Service Worker の更新は反映に時間がかかる。テスト時は DevTools で「Update on reload」を有効に。

---

## 次のフェーズ

Phase 1A 完了後、以下のサブプランを順次作成・実装：
- **Phase 1B**: Player 管理（オンボーディング、選手追加、ヘッダー切替UI）
- **Phase 1C**: Data layer（Supabase wrapper、IndexedDB、sync queue）
- **Phase 1D**: Match / AddressBook の Cloud CRUD
- **Phase 1E**: localStorage migration UI
