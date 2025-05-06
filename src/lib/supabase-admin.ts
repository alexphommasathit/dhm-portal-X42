import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Creates a Supabase admin client with the service role key
 * This client bypasses Row Level Security and should only be used server-side
 * for admin operations that require elevated privileges.
 */
export function createSupabaseAdmin() {
  // Make sure this is only used on the server
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseAdmin can only be used on the server');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL or Service Key is missing');
  }

  // Create client with admin privileges
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
