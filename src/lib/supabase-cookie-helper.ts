import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

/**
 * Creates a Supabase server client with proper cookie handling for route handlers.
 * This wrapper ensures cookies() is properly awaited to prevent Next.js warnings.
 */
export async function createSupabaseRouteHandlerClient(response?: NextResponse) {
  // Create a default response if one wasn't provided
  const actualResponse = response || NextResponse.next();
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          actualResponse.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          actualResponse.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  return { supabase, response: actualResponse };
}
