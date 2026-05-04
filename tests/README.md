# Tests (Playwright)

AI/開発者がブラウザ動作を自動確認するためのテストスイート。

## 実行コマンド

```bash
cd /Users/miyamotosoushi/Desktop/Antigravity_Company/Development/pingpong-app
npx playwright test                       # 全テスト
npx playwright test reload                # 特定スイートのみ
npx playwright test --reporter=line       # 短いログ
npx playwright test --headed              # ブラウザ画面を見る（macで便利）
```

## 出力

- 各テストの ✓ / ✗（コンソール）
- 失敗時のスクリーンショット → `test-results/` 配下
- ブラウザのコンソールログ・ネットワーク → trace で確認可能
- HTML レポート → `playwright-report/index.html`

## 環境変数（必須）

`.env.local` に以下を設定：
```
TEST_EMAIL=（テスト用アカウントのメール）
TEST_PASSWORD=（パスワード）
```

`dotenv` で `playwright.config.js` から自動読込される。

## テスト構成

- `auth.spec.js` — ログイン・ログアウトの基本フロー
- `reload.spec.js` — ハードリロード後のセッション維持（リグレッション防止）
- `player.spec.js` — 選手追加・切替

## 新しいテストを追加

`tests/` 配下に `*.spec.js` を追加。`./helpers/login.js` の `loginWithEmail` を使うとログイン処理が省略できる。
