import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

/**
 * Creates a Supabase client for server components
 * Note: In Next.js 15, cookies() is async and requires special handling
 */
export const createServerComponentClient = () => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookieStore = await cookies();
          return cookieStore.get(name)?.value;
        },
        async set(_name: string, _value: string, _options: CookieOptions) {
          // Cannot set cookies in server components directly
          console.warn('Warning: Setting cookies from server components is not supported');
        },
        async remove(_name: string, _options: CookieOptions) {
          // Cannot delete cookies in server components directly
          console.warn('Warning: Removing cookies from server components is not supported');
        },
      },
    }
  );
};

/**
 * Creates a Supabase client for middleware or API routes where request/response is available
 */
export const createMiddlewareSupabase = (request: NextRequest, response: NextResponse) => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.delete({
            name,
            ...options,
          });
        },
      },
    }
  );
};

/**
 * Creates a Supabase client for server actions where cookies can be modified
 * Note: This requires 'use server'; directive in the file using it
 */
export const createServerActionClient = () => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookieStore = await cookies();
          return cookieStore.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          const cookieStore = await cookies();
          cookieStore.set(name, value, options);
        },
        async remove(name: string) {
          const cookieStore = await cookies();
          cookieStore.delete(name);
        },
      },
    }
  );
};
