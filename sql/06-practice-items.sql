-- 練習ノートを「練習内容・意識することを選び、出来栄えを1〜5で付ける」形にする。2026-11-08 追加
-- Supabase の SQL Editor で実行する

-- ノートに選んだ項目と出来栄えを持たせる
-- 例: [{"kind":"menu","label":"フォア打ち","rating":4},{"kind":"focus","label":"打点","rating":null}]
--   kind: 'menu'=練習内容 / 'focus'=意識すること、rating: 1〜5（未評価は null）
ALTER TABLE practice_notes ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
-- practiced / good / issues は最初の版の名残。読み込み時に items へ変換し、新しい保存では空にする

-- 選手ごとの項目の設定（自分で足した項目と、非表示にした用意済みの項目）
-- 例: {"custom":{"menu":["チキータ"],"focus":[]},"hidden":{"menu":["体力・筋トレ"],"focus":[]}}
ALTER TABLE players ADD COLUMN IF NOT EXISTS practice_items jsonb NOT NULL DEFAULT '{}'::jsonb;
