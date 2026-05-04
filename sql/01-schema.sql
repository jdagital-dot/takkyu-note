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

DROP TRIGGER IF EXISTS matches_updated_at ON matches;
CREATE TRIGGER matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
