import { supabase } from './supabase-client.js';

export async function listByPlayer(playerId) {
  if (!playerId) return [];
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('player_id', playerId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createMatch(playerId, match) {
  if (!playerId) throw new Error('player_id is required');
  const row = {
    player_id: playerId,
    date: match.date || new Date().toISOString().slice(0, 10),
    opponent_name: match.opponent || null,
    opponent_team: match.team || null,
    opponent_age: match.age || null,
    opponent_pref: match.pref || null,
    opponent_hand: match.hand || null,
    opponent_type: match.type || null,
    match_type: match.matchType || null,
    score: match.score || null,
    win: match.win,
    tags: match.tags || [],
    memo: match.memo || null,
  };
  const { data, error } = await supabase
    .from('matches')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMatch(id, updates) {
  const row = {
    opponent_name: updates.opponent || null,
    opponent_team: updates.team || null,
    opponent_age: updates.age || null,
    opponent_pref: updates.pref || null,
    opponent_hand: updates.hand || null,
    opponent_type: updates.type || null,
    match_type: updates.matchType || null,
    score: updates.score || null,
    win: updates.win,
    tags: updates.tags || [],
    memo: updates.memo || null,
  };
  // date は指定されたときだけ更新（編集フローでは元の試合日を保持する）
  if (updates.date) row.date = updates.date;
  const { data, error } = await supabase
    .from('matches')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMatch(id) {
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export function rowToMatch(row) {
  return {
    id: row.id,
    date: formatDateJa(row.date),
    team: row.opponent_team || '',
    opponent: row.opponent_name || '',
    age: row.opponent_age || 14,
    pref: row.opponent_pref || '不明',
    hand: row.opponent_hand || '',
    type: row.opponent_type || '不明',
    matchType: row.match_type || '',
    score: row.score || '—',
    win: !!row.win,
    tags: Array.isArray(row.tags) ? row.tags : [],
    memo: row.memo || '',
    _remoteRow: row,
  };
}

function formatDateJa(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}
