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
import { Input } from '@/components/ui/input';

// Placeholder background image URL - replace with your desired image
const BACKGROUND_IMAGE_URL = '/images/login_background.jpeg';

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
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-cover bg-center p-4"
      style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
    >
      <Card className="w-full max-w-md bg-background/90 backdrop-blur-sm animate-fade-in-up">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-foreground">Login</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Welcome back! Please enter your details.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {fromPath && (
            <div className="p-3 text-sm text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 rounded-md">
              You&apos;ll be redirected to <code className="font-mono text-xs">{fromPath}</code>{' '}
              after login.
            </div>
          )}

          <Button
            variant="outline"
            className="w-full py-3 text-base border-border hover:bg-muted/50 transition-colors duration-300"
            onClick={handleGoogleLogin}
            disabled={loadingGoogle || loadingEmail}
          >
            {loadingGoogle ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <span> G Sign in with Google</span>
            )}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background/90 px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-muted-foreground mb-1"
              >
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="py-3 text-base"
                disabled={loadingGoogle || loadingEmail}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-muted-foreground"
                >
                  Password
                </label>
                <Link href="/auth/reset-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="py-3 text-base"
                disabled={loadingGoogle || loadingEmail}
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              className="w-full py-3 text-base"
              disabled={loadingGoogle || loadingEmail}
            >
              {loadingEmail ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in with Email'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col items-center justify-center space-y-2 pt-6">
          <div className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </div>
          <div className="text-xs text-muted-foreground/70">
            <Link href="/" className="hover:underline">
              Back to homepage
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
