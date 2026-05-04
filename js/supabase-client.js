import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://mxxajbziopkgjktccotg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14eGFqYnppb3BrZ2prdGNjb3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTk0OTEsImV4cCI6MjA5MjY5NTQ5MX0.yh3BsgO7rbGXShBQkU-GC_TZPPaS3KIE2uSiW13f1PA';

// navigator.locks のリロード直後ハング対策（タブ間競合は session storage で十分整合する）
const noOpLock = (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: true,
    lock: noOpLock,
  },
});
