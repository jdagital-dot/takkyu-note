# 卓球記録ノート (takkyu-note)

スマホで使える卓球の試合記録・分析PWAアプリ。

**本番:** https://pingpong-app-one.vercel.app

## 機能

- 試合記録（対戦相手、戦型、スコア、タグ、メモ）
- 戦型別・年齢別勝率の分析
- アドレス帳（過去の対戦相手をクラブ内で共有）
- マルチアカウント対応（兄弟など複数選手）
- オフライン対応（PWA）

## 技術スタック

- Vanilla HTML / CSS / ES Modules
- [Supabase](https://supabase.com)（認証・PostgreSQL）
- [Vercel](https://vercel.com)（ホスティング・自動デプロイ）
- [Playwright](https://playwright.dev)（E2Eテスト）

## ローカル開発

```bash
# 依存インストール
npm install

# .env.local を作成（.env.example をコピーして値を入れる）
cp .env.example .env.local

# ローカルサーバー起動
python3 -m http.server 8000
# → http://localhost:8000

# E2Eテスト
npx playwright test
```

## デプロイ

`main` ブランチに push すると Vercel が自動でデプロイします。

## ディレクトリ構成

```
pingpong-app/
├── index.html              # 単一HTMLエントリーポイント
├── js/
│   ├── main.js             # アプリ初期化・状態管理
│   ├── supabase-client.js  # Supabase接続
│   ├── auth.js, auth-ui.js # 認証
│   ├── account.js          # アカウント管理
│   ├── players.js, player-ui.js, player-edit.js # 選手管理
│   ├── matches.js, matches-cache.js # 試合記録
│   ├── opponents.js, opponents-cache.js # アドレス帳
│   ├── onboarding.js       # 初回オンボーディング
│   └── player-state.js     # 現在選手の state
├── sql/                    # Supabase スキーマ・RLS
├── tests/                  # Playwright E2E
├── docs/superpowers/       # 仕様書・実装プラン
├── manifest.json, sw.js    # PWA
└── icon-*.png              # アプリアイコン
```
