import { supabase } from './supabase-client.js';

export async function listAll(accountId) {
  if (!accountId) return [];
  const { data, error } = await supabase
    .from('opponents')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createOpponent(accountId, opp) {
  if (!accountId) throw new Error('account_id is required');
  if (!opp.name) throw new Error('name is required');
  const row = {
    account_id: accountId,
    name: opp.name,
    team: opp.team || null,
    age: opp.age || null,
    pref: opp.pref || null,
    hand: opp.hand || null,
    type: opp.type || null,
  };
  const { data, error } = await supabase
    .from('opponents')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOpponent(id) {
  const { error } = await supabase
    .from('opponents')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export function rowToOpponent(row) {
  return {
    id: row.id,
    name: row.name,
    team: row.team || '',
    age: row.age || 0,
    pref: row.pref || '',
    hand: row.hand || '',
    type: row.type || '',
  };
}
