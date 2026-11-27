import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { env } from './env';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublicKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function getPublicStorageUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

