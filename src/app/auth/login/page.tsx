'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginWithEmail, loginWithGoogle } from '@/app/actions';
import { cleanSupabaseCookies } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function LoginPage() {
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get the 'from' parameter which indicates where the user was trying to go
  const fromPath = searchParams.get('from');

  // Clean cookies on initial load to ensure fresh auth state
  useEffect(() => {
    // Clear any existing cookies on page load to start fresh
    cleanSupabaseCookies();
  }, []);

  // Email/Password Handler
  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingEmail(true);

    try {
      // Clean any existing problematic cookies first
      cleanSupabaseCookies();

      // Get form data
      const formData = new FormData(e.currentTarget);

      // Login with server action
      const result = await loginWithEmail(formData);

      if (!result.success) {
        // Ensure error message is a string
        throw new Error(result.error ?? 'Login failed with an unknown error');
      }

      // Successful login - redirect to original path or home
      // Removing the setTimeout, relying on router.refresh() and middleware
      router.push(fromPath || '/');
      router.refresh(); // Refresh to ensure layout reflects auth state
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';

      toast({
        title: 'Login failed',
        description: errorMessage,
        variant: 'destructive',
      });

      // Try once more to clean cookies when login fails
      cleanSupabaseCookies();
    } finally {
      // Ensure loading state is always reset
      setLoadingEmail(false);
    }
  };

  // Google OAuth Handler
  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    // Clean cookies before initiating OAuth flow
    cleanSupabaseCookies();
    try {
      // Pass 'fromPath' to potentially redirect back after Supabase callback
      const result = await loginWithGoogle(fromPath);
      if (result.error) {
        throw new Error(result.error);
      }
      // If signInWithOAuth returns a URL, redirect the user's browser
      if (result.url) {
        // No need to setLoadingGoogle(false) here, the page will navigate away
        window.location.href = result.url;
      } else {
        // Should not happen if Supabase is configured correctly
        throw new Error('Could not get Google login URL.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      toast({
        title: 'Google Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      setLoadingGoogle(false); // Only set loading false if there was an error
      cleanSupabaseCookies(); // Clean again on error
    }
    // No finally block to set loading false here, as successful navigation away handles it.
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Sign In</CardTitle>
        <CardDescription className="text-center">
          Sign in using your Google account or email
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {fromPath && (
          <div className="mb-4 p-3 text-sm text-blue-700 bg-blue-50 rounded-md">
            You&apos;ll be redirected to <code className="font-mono text-xs">{fromPath}</code> after
            login.
          </div>
        )}

        {/* --- Google Login Button --- */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={loadingGoogle || loadingEmail}
        >
          {loadingGoogle ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <span>Sign in with Google</span>
          )}
        </Button>

        <div className="relative my-4">
          {' '}
          {/* Added margin */}
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        {/* --- Email/Password Form --- */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
              disabled={loadingGoogle || loadingEmail}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link
                href="/auth/reset-password"
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
              disabled={loadingGoogle || loadingEmail}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loadingGoogle || loadingEmail}>
            {loadingEmail ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in with Email'
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center">
        <div className="text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/" className="font-medium text-blue-600 hover:text-blue-800">
            Sign up
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
