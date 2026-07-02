import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://mxxajbziopkgjktccotg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14eGFqYnppb3BrZ2prdGNjb3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTk0OTEsImV4cCI6MjA5MjY5NTQ5MX0.yh3BsgO7rbGXShBQkU-GC_TZPPaS3KIE2uSiW13f1PA';

// Supabase v2 がセッションを保存する localStorage キー（main.js の即時判定・ログアウトで使用）
export const AUTH_STORAGE_KEY = 'sb-mxxajbziopkgjktccotg-auth-token';

// navigator.locks のリロード直後ハング対策（タブ間競合は session storage で十分整合する）
const noOpLock = (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    // 大会中など長時間開きっぱなしでもトークン失効しないよう自動更新する
    // （過去のハングは navigator.locks が原因で、noOpLock で解消済み）
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: noOpLock,
  },
});
