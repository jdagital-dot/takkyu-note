-- すべてのテーブルでRLSを有効化
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponents ENABLE ROW LEVEL SECURITY;

-- accounts: 自分のレコードだけ読み書きできる
DROP POLICY IF EXISTS "users select own account" ON accounts;
CREATE POLICY "users select own account" ON accounts
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "users insert own account" ON accounts;
CREATE POLICY "users insert own account" ON accounts
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users update own account" ON accounts;
CREATE POLICY "users update own account" ON accounts
  FOR UPDATE USING (id = auth.uid());

-- players: 自分のアカウントの選手だけ
DROP POLICY IF EXISTS "users access own players" ON players;
CREATE POLICY "users access own players" ON players
  FOR ALL USING (account_id = auth.uid());

-- matches: 自分の選手の試合だけ
DROP POLICY IF EXISTS "users access own matches" ON matches;
CREATE POLICY "users access own matches" ON matches
  FOR ALL USING (
    player_id IN (SELECT id FROM players WHERE account_id = auth.uid())
  );

-- opponents: 自分のアカウントのアドレス帳だけ
DROP POLICY IF EXISTS "users access own opponents" ON opponents;
CREATE POLICY "users access own opponents" ON opponents
  FOR ALL USING (account_id = auth.uid());
