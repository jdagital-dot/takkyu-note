import { supabase } from './supabase-client.js';
import { legacyToItems } from './practice-tags.js';

const arr = v => (Array.isArray(v) ? v : []);

const RATED = r => (Number.isInteger(r) && r >= 1 && r <= 5 ? r : null);

export function rowToNote(row) {
  // 最初の版（practiced/good/issues）で保存されたノートは items に変換して読む
  const items = arr(row.items).length
    ? arr(row.items)
        .filter(i => i && (i.kind === 'menu' || i.kind === 'focus') && typeof i.label === 'string')
        .map(i => ({ kind: i.kind, label: i.label, rating: RATED(i.rating) }))
    : legacyToItems(arr(row.practiced), arr(row.good), arr(row.issues));
  return {
    id: row.id,
    date: row.date,
    minutes: row.minutes ?? null,
    items,
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
    items: (note.items || []).map(i => ({ kind: i.kind, label: i.label, rating: i.rating ?? null })),
    // 最初の版の列は使わない（読み込み時の変換と二重にならないよう空にする）
    practiced: [],
    good: [],
    issues: [],
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
