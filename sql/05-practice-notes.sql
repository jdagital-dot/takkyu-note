-- 練習ノート（1日1件）。2026-11-08 追加
-- Supabase の SQL Editor で実行する

CREATE TABLE IF NOT EXISTS practice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  date date NOT NULL,
  minutes int,                              -- 練習時間（分）。休みは 0、未記入は null
  practiced jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 練習した技術
  good jsonb NOT NULL DEFAULT '[]'::jsonb,        -- ◎できた
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,      -- △課題
  memo text,                                -- 一言
  source text NOT NULL DEFAULT 'app',       -- 'app' | 'paper'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, date)
);
CREATE INDEX IF NOT EXISTS idx_practice_notes_player_date ON practice_notes(player_id, date DESC);

DROP TRIGGER IF EXISTS trg_practice_notes_updated_at ON practice_notes;
CREATE TRIGGER trg_practice_notes_updated_at
  BEFORE UPDATE ON practice_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 自分の選手のノートだけ読み書きできる（matches と同じ形）
ALTER TABLE practice_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users access own practice notes" ON practice_notes;
CREATE POLICY "users access own practice notes" ON practice_notes
  FOR ALL USING (
    player_id IN (SELECT id FROM players WHERE account_id = auth.uid())
  )
  WITH CHECK (
    player_id IN (SELECT id FROM players WHERE account_id = auth.uid())
  );
