'use client';

import { createBrowserClient } from '@supabase/ssr';
// Remove the import for the older library
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

/**
 * Creates a Supabase client for client components using @supabase/ssr
 * This should be used in contexts or components requiring client-side Supabase access.
 */
export const createClientComponentSupabase = () => {
  // Use createBrowserClient from @supabase/ssr
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

/**
 * Creates a Supabase client for browser usage
 */
export const createBrowserSupabase = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

/**
 * Clean all Supabase auth cookies
 * This includes both standard Supabase cookies and any problematic 'based-' cookies
 */
export const cleanSupabaseCookies = () => {
  if (typeof document !== 'undefined') {
    // First, get all cookies
    const allCookies = document.cookie.split(';');

    // Define all paths to cleanup cookies on
    const pathsToClean = ['/', '/auth', '/api', '/api/auth', '/api/auth/callback'];

    allCookies.forEach(cookie => {
      const [name] = cookie.split('=').map(c => c.trim());

      if (!name) return;

      // Target all possible Supabase-related cookies
      if (
        name.startsWith('sb-') ||
        name.startsWith('supabase-') ||
        name.startsWith('based-') ||
        name === '__supabase_auth_token' ||
        name === '_supabase_session'
      ) {
        // Delete the cookie on all potential paths
        pathsToClean.forEach(path => {
          // Delete with various domain settings that might be used
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; secure;`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path};`;

          // Also try without secure flag
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path};`;
        });

        // Also try root domain delete
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      }
    });

    // Force browser reload to ensure all remnants are cleared
    console.log('All Supabase cookies have been cleared');
  }
};
