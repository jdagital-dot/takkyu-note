-- ゲームカウントのみの記録（かんたん入力）／2026-08-18 設計書に対応
-- 実行順序: このSQLを Supabase の SQL Editor で先に実行し、
--           成功を確認してからアプリをデプロイする。
--           逆順にすると列が無い状態で試合の保存が失敗する。
-- nullable のため既存の試合レコードは無影響（null = 従来どおり score から逆算）。

ALTER TABLE matches ADD COLUMN IF NOT EXISTS games_won  int;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS games_lost int;
