'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function AuthConfirmPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthConfirmPage: onAuthStateChange event:', event, 'session:', session);
      if (event === 'SIGNED_IN' && session) {
        // TODO: Consider redirecting based on role or if profile completion is needed
        router.push('/dashboard'); // Placeholder redirect
      } else if (event === 'SIGNED_OUT') {
        router.push('/login'); // Placeholder redirect
      }
      // Add handling for other events like PASSWORD_RECOVERY if this page is multi-purpose
    });

    // Check for errors in the URL fragment from Supabase redirect
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1)); // Remove #
      const error = params.get('error');
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');
      console.error('Supabase Auth Error on Confirm Page:', { error, errorCode, errorDescription });
      // TODO: Display a user-friendly error message to the user
      // if (errorCode === 'otp_expired') {
      //   router.push('/invitation-expired'); // Example
      // }
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Processing your authentication...</h1>
      <p>Please wait while we confirm your details.</p>
      {/* TODO: Add a loading spinner component */}
    </div>
  );
}
