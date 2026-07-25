import { supabase } from './supabase-client.js';

export async function listPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPlayer({ name, grade, hand = null, play_type = null, team = null, pref = null, gender = null }) {
  if (!name) throw new Error('Name is required');
  // session から user を取る（getUser() が lock 競合でハングするケース回避）
  const { data: sessData } = await supabase.auth.getSession();
  const user = sessData?.session?.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('players')
    .insert({ account_id: user.id, name, grade, hand, play_type, team, pref, gender })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(id, updates) {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(id) {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
