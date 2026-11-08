import { supabase } from './supabase-client.js';

const arr = v => (Array.isArray(v) ? v : []);

export function rowToNote(row) {
  return {
    id: row.id,
    date: row.date,
    minutes: row.minutes ?? null,
    practiced: arr(row.practiced),
    good: arr(row.good),
    issues: arr(row.issues),
    memo: row.memo || '',
    source: row.source || 'app',
  };
}

export async function listByPlayer(playerId) {
  if (!playerId) return [];
  const { data, error } = await supabase
    .from('practice_notes')
    .select('*')
    .eq('player_id', playerId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

// 1日1件。同じ日のノートがあれば上書きする（紙の取り込みのやり直しも同じ経路）
export async function upsertNote(playerId, note) {
  if (!playerId) throw new Error('player_id is required');
  const row = {
    player_id: playerId,
    date: note.date,
    minutes: note.minutes ?? null,
    practiced: note.practiced || [],
    good: note.good || [],
    issues: note.issues || [],
    memo: (note.memo || '').trim() || null,
    source: note.source || 'app',
  };
  const { data, error } = await supabase
    .from('practice_notes')
    .upsert(row, { onConflict: 'player_id,date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(id) {
  const { error } = await supabase.from('practice_notes').delete().eq('id', id);
  if (error) throw error;
}
