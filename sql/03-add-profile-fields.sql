-- 設定画面＋プロフィール拡張（2026-07-24 設計書に対応）
-- 実行順序: このSQLを Supabase の SQL Editor で先に実行し、
--           成功を確認してからアプリをデプロイする。
--           逆順にすると列が無い状態で選手の保存が失敗する。
-- すべて nullable / デフォルト値なしのため、既存レコードは無影響。

-- 選手プロフィールの拡張（試合カードの自分側表示に使う）
ALTER TABLE players   ADD COLUMN IF NOT EXISTS team   text;
ALTER TABLE players   ADD COLUMN IF NOT EXISTS pref   text;
ALTER TABLE players   ADD COLUMN IF NOT EXISTS gender text;

-- 相手の性別（性別別勝率の集計に使う。第3段で利用）
ALTER TABLE matches   ADD COLUMN IF NOT EXISTS opponent_gender text;
ALTER TABLE opponents ADD COLUMN IF NOT EXISTS gender          text;

-- 退会（アカウント削除）に必要。
-- accounts には DELETE ポリシーが無かったため、自分の行だけ削除できるようにする。
-- この1行の削除で players → matches、opponents が ON DELETE CASCADE で連鎖削除される。
DROP POLICY IF EXISTS "users delete own account" ON accounts;
CREATE POLICY "users delete own account" ON accounts
  FOR DELETE USING (id = auth.uid());
