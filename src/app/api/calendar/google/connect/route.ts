import { NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { auditLogger } from '@/lib/audit-logger';

// Google OAuth2 configuration
const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL}/api/calendar/google/callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export async function GET(/* req: NextRequest */) {
  try {
    // Initialize Supabase client using the consistent helper
    const supabase = createServerActionClient();

    // Get user session (uses async cookie handlers)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);

    // Store state in cookies for verification during callback
    const cookieStore = await cookies();
    cookieStore.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    // Log the connection attempt
    await auditLogger.logEvent({
      user_id: session.user.id,
      action: 'connect',
      resource_type: 'google_calendar',
      success: true,
    });

    // Construct the OAuth authorization URL
    const authUrl = new URL(GOOGLE_OAUTH_URL);
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', SCOPES.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('prompt', 'consent'); // Force prompt to ensure refresh token

    // Redirect the user to Google's OAuth page
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Google Calendar connection:', error);

    return NextResponse.json(
      { error: 'Failed to initiate Google Calendar connection' },
      { status: 500 }
    );
  }
}
