# 卓球記録ノート MVP デプロイ＆モバイル対応 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現在の `pingpong-prototype.html` を、J.STYLE の子たちが実際にスマホで使える Web アプリとして公開する。

**Architecture:**
- 単一HTMLファイルを Vercel で静的ホスティング
- レスポンシブCSSでスマホ画面に自動適応
- PWA化してホーム画面にインストール可能に
- データはlocalStorage（既実装）でデバイス内に永続化

**Tech Stack:** HTML/CSS/JS（Vanilla）、Vercel（ホスティング）、PWA（manifest + Service Worker）

**対象ファイル:** `/Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-prototype.html`

---

## Phase A: デプロイ（URL で共有可能にする）

### Task A-1: デプロイ用プロジェクト構成

**Files:**
- Create: `Development/pingpong-app/index.html` （既存 `pingpong-prototype.html` のコピー）
- Create: `Development/pingpong-app/vercel.json` （Vercel設定）

- [ ] **Step 1: プロジェクトディレクトリ作成とファイルコピー**

```bash
mkdir -p /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
cp /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-prototype.html \
   /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app/index.html
```

- [ ] **Step 2: Vercel 設定ファイル作成**

`Development/pingpong-app/vercel.json`:
```json
{
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

- [ ] **Step 3: 動作確認（ローカル）**

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
python3 -m http.server 8000
```
ブラウザで `http://localhost:8000` を開き、記録/アドレス帳が動作することを確認。Ctrl+C で停止。

### Task A-2: Vercel デプロイ

- [ ] **Step 1: Vercel CLI インストール**

```bash
npm install -g vercel
```

確認: `vercel --version` で表示されること

- [ ] **Step 2: Vercel ログイン**

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
vercel login
```
メールでログイン（GitHub アカウント連携でもOK）。

- [ ] **Step 3: 初回デプロイ**

```bash
vercel
```

対話プロンプトの回答：
- Set up and deploy: `Y`
- Scope: （個人アカウント選択）
- Link to existing project: `N`
- Project name: `pingpong-app`
- Directory: `./` (Enter)
- Override settings: `N`

- [ ] **Step 4: 本番デプロイ**

```bash
vercel --prod
```

完了後、`https://pingpong-app-xxxx.vercel.app` の URL が発行される。**このURLをメモ**。

- [ ] **Step 5: スマホで動作確認**

自分のスマホでURLを開き：
- 記録画面でフォームが開けるか
- ボタンがタップできるか
- 画面遷移が動くか
- レイアウトの問題点をメモ（Phase B で修正する）

---

## Phase B: レスポンシブ化（スマホに最適化）

### Task B-1: 固定幅レイアウトを解除

**Files:**
- Modify: `pingpong-app/index.html` の CSS 部分

- [ ] **Step 1: `.phone` の固定サイズを外す**

現在の CSS:
```css
.phone {
  width: 390px;
  height: 844px;
  background: #fff;
  border-radius: 40px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  ...
}
```

変更後（画面サイズでモック枠/フル画面を切替）：
```css
.phone {
  width: 100%;
  max-width: 390px;
  min-height: 100vh;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  border-radius: 40px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

@media (max-width: 500px) {
  body { padding: 0; align-items: stretch; }
  .phone {
    max-width: 100%;
    min-height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }
  .status-bar { display: none; }
}
```

- [ ] **Step 2: Safe area 対応を追加**

`<head>` の viewport meta を更新:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover">
```

body/phone CSS に safe-area padding 追加:
```css
.phone {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(72px + env(safe-area-inset-bottom));
}
```

- [ ] **Step 3: ステータスバー部分の調整**

スマホ実機ではOSのステータスバーが既にあるので、`.status-bar` は非表示にする（Step 1のメディアクエリで実施済み）。

- [ ] **Step 4: ローカルで確認**

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
python3 -m http.server 8000
```

Chromeデベロッパーツール → デバイスモード → iPhone 12 などで表示崩れがないか確認。

### Task B-2: フォント・タップエリア調整

- [ ] **Step 1: 入力フィールドのフォントサイズを16pxに**

iOS Safari は input のフォントサイズが16px未満だとフォーカス時にズームする。該当箇所を確認:

```css
.form-row input, .form-row select, .form-row textarea {
  ...
  font-size: 16px;  /* 15px → 16px */
  ...
}
```

- [ ] **Step 2: タップハイライト除去**

CSS の冒頭あたりに追加:
```css
* {
  -webkit-tap-highlight-color: transparent;
}
button, .type-btn, .tag-btn, .nav-item, .match-card, .modal-close, .fab, .picker-row {
  -webkit-user-select: none;
}
```

- [ ] **Step 3: デプロイして実機確認**

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
vercel --prod
```
スマホで開き、タップ・フォーカス時のズレ・ズームがないことを確認。

### Task B-3: Phase B コミット（git 初期化は任意）

このプロジェクトはgit未管理なので、任意でgit init するか、スキップして次のフェーズへ。

---

## Phase C: PWA化（ホーム画面にアプリとして追加可能に）

### Task C-1: アプリアイコン作成

**Files:**
- Create: `pingpong-app/icon-192.png`
- Create: `pingpong-app/icon-512.png`

- [ ] **Step 1: アイコン画像の準備**

最初は簡易なものでOK。以下のいずれか：
- **オプションA: 絵文字で生成（最速）** — Claudeに頼んで SVG → PNG 変換
- **オプションB: 自作** — ペイントアプリで512x512の画像を作成し192x192にリサイズ
- **オプションC: プレースホルダー** — https://placehold.co/512x512/1a1a2e/e53935?text=🏓

**推奨: オプションA** — 以下のSVGを作成して `pingpong-app/icon.svg` として保存後、ImageMagickで変換:

`icon.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1a1a2e"/>
  <circle cx="256" cy="256" r="140" fill="#e53935"/>
  <text x="256" y="310" font-size="180" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">卓</text>
</svg>
```

変換:
```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
# ImageMagickが無ければインストール: brew install imagemagick
magick icon.svg -resize 512x512 icon-512.png
magick icon.svg -resize 192x192 icon-192.png
```

### Task C-2: manifest.json 作成

**Files:**
- Create: `pingpong-app/manifest.json`

- [ ] **Step 1: manifest.json 作成**

`pingpong-app/manifest.json`:
```json
{
  "name": "卓球記録ノート",
  "short_name": "卓球ノート",
  "description": "試合記録と分析ができる卓球日記アプリ",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f0f2f5",
  "theme_color": "#e53935",
  "lang": "ja",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: index.html の `<head>` に link を追加**

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#e53935">
<link rel="apple-touch-icon" href="/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="卓球ノート">
```

### Task C-3: Service Worker（オフライン対応）

**Files:**
- Create: `pingpong-app/sw.js`

- [ ] **Step 1: sw.js 作成**

`pingpong-app/sw.js`:
```javascript
const CACHE = 'pingpong-v1';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
```

- [ ] **Step 2: index.html の `<script>` 冒頭で Service Worker 登録**

`<script>` タグの一番最初に追加:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW registration failed', e));
}
```

### Task C-4: 最終デプロイと実機検証

- [ ] **Step 1: 全ファイルをデプロイ**

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
ls  # index.html, manifest.json, sw.js, icon-192.png, icon-512.png, vercel.json が揃っていることを確認
vercel --prod
```

- [ ] **Step 2: iPhone での動作確認**

1. Safari でデプロイURLを開く
2. 共有ボタン → 「ホーム画面に追加」
3. ホーム画面にアイコンが表示されることを確認
4. アイコンをタップしてアプリとして起動（ブラウザUIが出ないこと）
5. 機内モードで開いてもキャッシュから動くこと

- [ ] **Step 3: Android での動作確認**

1. Chrome でデプロイURLを開く
2. 画面下に「ホーム画面に追加」バナーが出ることを確認
3. インストール → アプリとして起動確認

---

## 検証チェックリスト（全Phase完了後）

- [ ] PCブラウザで `https://pingpong-app-xxxx.vercel.app` が開ける
- [ ] スマホで URL を開いたとき、画面全体を使って表示される（固定枠じゃない）
- [ ] フォーム入力時に画面がズームしない
- [ ] 記録→リロード→記録が残っている（localStorage動作）
- [ ] ホーム画面に追加できる（PWA）
- [ ] ホーム画面から起動するとアプリっぽい表示（ブラウザUI無し）
- [ ] オフラインでも開く（Service Worker動作）
- [ ] J.STYLEの子1人にURLを共有して、1試合分の記録ができた

---

## Phase 完了後の次のアクション（Phase 0：検証）

1. LINEで3〜5人の子（または保護者）にURL + 使い方を送る
2. 2週間運用してもらう
3. フィードバック収集（Googleフォームでも口頭でもOK）
4. バグ・改善点をまとめて次のプラン（Phase 2: クラウド化）の入力とする

---

## 注意点・前提条件

- Vercel アカウント作成が必要（無料・メールのみでOK）
- Node.js が入っていること（確認済み: `/Users/miyamotosoushi/local/node/bin/node`）
- ImageMagick のインストールが必要（Task C-1）: `brew install imagemagick`
- このプロジェクトは git 未管理。Phase完了後に git init して GitHub 連携すると継続デプロイが楽になる（任意）

