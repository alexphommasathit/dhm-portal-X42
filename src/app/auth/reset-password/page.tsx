'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import Link from 'next/link';

export default function ResetPassword() {
  const supabase = createClientComponentSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get the access token from the URL if present (for reset password flow)
  const accessToken = searchParams.get('access_token');

  // States for both request and update flows
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form validation state
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [isValidPassword, setIsValidPassword] = useState(true);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  // Check if we have an access token (this means we're in the reset flow, not request flow)
  const isResetFlow = !!accessToken;

  // Validate email format
  const validateEmail = (email: string) => {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setIsValidEmail(valid);
    return valid;
  };

  // Validate password strength
  const validatePassword = (password: string) => {
    // At least 8 characters, at least one uppercase letter, one lowercase letter, and one number
    const valid =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password);
    setIsValidPassword(valid);
    return valid;
  };

  // Validate passwords match
  const validatePasswordsMatch = () => {
    const match = password === confirmPassword;
    setPasswordsMatch(match);
    return match;
  };

  // Handle password reset request (step 1)
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    if (!validateEmail(email)) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_URL || window.location.origin}/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      setMessage('Password reset email sent! Check your inbox for further instructions.');
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      setError(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle password update (step 2)
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password
    if (!validatePassword(password) || !validatePasswordsMatch()) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      // Reset was successful
      setMessage('Password updated successfully! Redirecting to login...');

      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Error updating password:', error);
      setError(error.message || 'Failed to update password. The reset link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  // On mount, verify the access token if we have one
  useEffect(() => {
    if (accessToken) {
      // When the component mounts with an accessToken,
      // check if the token is valid (Supabase does this automatically)
      const checkToken = async () => {
        try {
          // getSession will find the user from the URL token
          const { data, error } = await supabase.auth.getSession();

          if (error || !data.session) {
            throw error || new Error('Invalid or expired token');
          }

          // Token is valid
          console.log('Valid reset token');
        } catch (error: any) {
          console.error('Invalid reset token:', error);
          setError('Invalid or expired password reset link. Please request a new one.');

          // Redirect to request page after a delay
          setTimeout(() => {
            // Remove the token from URL
            router.push('/auth/reset-password');
          }, 2000);
        }
      };

      checkToken();
    }
  }, [accessToken, supabase, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {isResetFlow ? 'Set New Password' : 'Reset Password'}
          </h2>
          <p className="text-gray-600 mt-2">
            {isResetFlow
              ? 'Please enter your new password below.'
              : 'Enter your email to receive a password reset link.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-md">
            <p className="font-medium">Success</p>
            <p className="text-sm">{message}</p>
          </div>
        )}

        {isResetFlow ? (
          // Update password form
          <form onSubmit={handlePasswordUpdate} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (e.target.value) validatePassword(e.target.value);
                  if (confirmPassword) validatePasswordsMatch();
                }}
                onBlur={() => validatePassword(password)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isValidPassword && password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter a strong password"
                disabled={loading}
                required
              />
              {!isValidPassword && password && (
                <p className="mt-1 text-sm text-red-600">
                  Password must be at least 8 characters and include uppercase, lowercase, and
                  numbers.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  if (password && e.target.value) validatePasswordsMatch();
                }}
                onBlur={validatePasswordsMatch}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !passwordsMatch && confirmPassword ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Confirm your password"
                disabled={loading}
                required
              />
              {!passwordsMatch && confirmPassword && (
                <p className="mt-1 text-sm text-red-600">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isValidPassword || !passwordsMatch}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        ) : (
          // Request reset form
          <form onSubmit={handleResetRequest} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (e.target.value) validateEmail(e.target.value);
                }}
                onBlur={() => validateEmail(email)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isValidEmail && email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
                disabled={loading}
                required
              />
              {!isValidEmail && email && (
                <p className="mt-1 text-sm text-red-600">Please enter a valid email address.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isValidEmail}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-sm text-blue-600 hover:text-blue-800">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
