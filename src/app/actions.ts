'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Server action to handle user logout
 */
export async function logoutUser() {
  try {
    const supabase = createServerActionClient();
    await supabase.auth.signOut();

    // Manually clear cookies after signOut
    await clearAllAuthCookies();

    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during logout',
    };
  }
}

/**
 * Server action to handle login with email and password
 */
export async function loginWithEmail(formData: FormData) {
  const supabase = createServerActionClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login Error:', error.message);
    if (error.message.includes('Invalid login credentials')) {
      return { success: false, error: 'Invalid email or password.' };
    }
    if (error.message.includes('Email not confirmed')) {
      return { success: false, error: 'Please confirm your email address first.' };
    }
    return { success: false, error: `Authentication failed: ${error.message}` };
  }

  return { success: true, error: null };
}

/**
 * Special action to clear all authentication cookies
 */
export async function clearAllAuthCookies() {
  try {
    const cookieStore = await cookies();

    // Cookie names to check and delete
    const cookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      'based-eyJ',
      '__supabase_auth_token',
      '_supabase_session',
    ];

    // Delete specific known cookies
    for (const name of cookieNames) {
      try {
        if (await cookieStore.has(name)) {
          cookieStore.delete(name);
        }
      } catch (e) {
        console.warn(`Could not delete cookie ${name}:`, e);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error clearing cookies:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error clearing cookies',
    };
  }
}

// --- Add Google Login Server Action ---
export async function loginWithGoogle(fromPath: string | null) {
  try {
    // Get origin from headers() asynchronously
    const headers = await import('next/headers').then(mod => mod.headers());
    const origin = headers.get('origin');

    if (!origin) {
      console.error('Could not determine origin URL for OAuth redirect.');
      return { error: 'Could not determine redirect URL.', url: null };
    }

    // Now create the client which uses ASYNC cookie handlers internally
    const supabase = createServerActionClient();

    // Construct the redirect URL using the obtained origin
    const redirectUrl = fromPath ? `${origin}${fromPath}` : `${origin}/`;

    console.log(`Initiating Google OAuth. Redirecting back to: ${redirectUrl}`);

    // signInWithOAuth will use the async cookie methods defined in createServerActionClient
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // This is where Supabase redirects the user AFTER successful Google authentication and callback handling
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('Google OAuth Error:', error.message);
      return { error: `Google sign-in failed: ${error.message}`, url: null };
    }

    if (data.url) {
      // IMPORTANT: Return the Google Auth URL for client-side redirection.
      return { error: null, url: data.url };
    } else {
      console.error('No URL returned from signInWithOAuth');
      return { error: 'Could not get Google sign-in URL.', url: null };
    }
  } catch (error) {
    console.error('Unexpected error during Google login action:', error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
    return { error: message, url: null };
  }
}
