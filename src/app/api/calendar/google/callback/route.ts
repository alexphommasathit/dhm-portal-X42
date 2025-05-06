import { NextRequest, NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { auditLogger } from '@/lib/audit-logger';

// Google OAuth2 configuration
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL}/api/calendar/google/callback`;

export async function GET(req: NextRequest) {
  try {
    // Initialize Supabase client using the consistent helper
    const supabase = createServerActionClient();

    // Get user session (uses async cookie handlers)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=auth_required`);
    }

    // Get the authorization code and state from the URL
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('Google OAuth error:', error);
      await auditLogger.logEvent({
        user_id: session.user.id,
        action: 'oauth_callback',
        resource_type: 'google_calendar',
        details: { error },
        success: false,
      });
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/calendar?error=${error}`);
    }

    // Verify the request has both code and state
    if (!code || !state) {
      console.error('Missing code or state in callback');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/calendar?error=invalid_response`
      );
    }

    // Verify state matches what we stored (CSRF protection)
    const cookieStore = await cookies();
    const storedState = cookieStore.get('google_oauth_state')?.value;

    if (!state || !storedState || state !== storedState) {
      console.error('Invalid state parameter');
      // Clear potentially compromised cookie
      cookieStore.delete('google_oauth_state');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/calendar?error=state_mismatch`);
    }

    // Exchange the authorization code for access and refresh tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Error exchanging code for tokens:', errorData);
      await auditLogger.logEvent({
        user_id: session.user.id,
        action: 'oauth_callback',
        resource_type: 'google_calendar',
        details: { error: errorData },
        success: false,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/calendar?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();

    // Calculate token expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Store the tokens in the database
    const { data: tokenRecord, error: dbError } = await supabase
      .from('calendar_tokens')
      .upsert(
        {
          user_id: session.user.id,
          provider: 'google',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'user_id, provider' }
      )
      .select()
      .single();

    if (dbError) {
      console.error('Error saving Google tokens:', dbError);
      await auditLogger.logEvent({
        user_id: session.user.id,
        action: 'oauth_callback',
        resource_type: 'google_calendar',
        details: { error: dbError.message },
        success: false,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/calendar?error=token_save_failed`
      );
    }

    // Log successful connection
    await auditLogger.logEvent({
      user_id: session.user.id,
      action: 'oauth_callback',
      resource_type: 'google_calendar',
      success: true,
    });

    // Clear the state cookie
    cookieStore.delete('google_oauth_state');

    // Redirect back to the calendar page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/calendar?success=google_connected`
    );
  } catch (error) {
    console.error('Error handling Google OAuth callback:', error);

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/calendar?error=server_error`);
  }
}
