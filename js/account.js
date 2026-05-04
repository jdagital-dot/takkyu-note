import { supabase } from './supabase-client.js';

export async function getOrCreateAccount(userArg = null) {
  console.log('[acct] start');
  let user = userArg;
  if (!user) {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  }
  if (!user) throw new Error('Not authenticated');
  console.log('[acct] user ok, querying...');

  const { data: existing, error: selectError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  console.log('[acct] query done, existing?', !!existing, 'err:', selectError?.message);
  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from('accounts')
    .insert({
      id: user.id,
      email: user.email,
      role: 'individual',
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return created;
}

export async function updateAccount(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
