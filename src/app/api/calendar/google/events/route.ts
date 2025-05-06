import { NextRequest, NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase/server';
// import { cookies } from 'next/headers'; // Not needed
import { refreshGoogleToken } from '@/lib/calendar/google-token';
import { auditLogger } from '@/lib/audit-logger';

// Google Calendar API base URL
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Helper to fetch token from database and refresh if needed
async function getValidToken(supabase: any, userId: string) {
  // Get the token from database
  const { data: tokenData, error: tokenError } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single();

  if (tokenError || !tokenData) {
    throw new Error('Calendar not connected');
  }

  // Check if token is expired or about to expire (5 minute buffer)
  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);
  const tokenIsExpired = expiresAt <= new Date(now.getTime() + 5 * 60 * 1000);

  // If expired, refresh the token
  if (tokenIsExpired) {
    if (!tokenData.refresh_token) {
      throw new Error('No refresh token available');
    }

    const refreshedToken = await refreshGoogleToken(tokenData.refresh_token);

    // Update database with new token information
    const { error: updateError } = await supabase
      .from('calendar_tokens')
      .update({
        access_token: refreshedToken.access_token,
        expires_at: refreshedToken.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenData.id);

    if (updateError) {
      throw new Error('Failed to update token');
    }

    return refreshedToken.access_token;
  }

  // Return the existing valid token
  return tokenData.access_token;
}

// GET handler for listing events
export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client (no args)
    const supabase = createServerActionClient();

    // Get user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax');
    const maxResults = searchParams.get('maxResults') || '100';

    // Get access token (refreshed if needed)
    const accessToken = await getValidToken(supabase, session.user.id);

    // Prepare request parameters
    const params = new URLSearchParams({
      timeMin,
      maxResults,
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    // Add optional timeMax parameter if provided
    if (timeMax) {
      params.append('timeMax', timeMax);
    }

    // Fetch events from Google Calendar API
    const eventsResponse = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!eventsResponse.ok) {
      const errorData = await eventsResponse.json();
      console.error('Google Calendar API error:', errorData);

      await auditLogger.logEvent({
        user_id: session.user.id,
        action: 'list',
        resource_type: 'google_calendar_events',
        details: { error: errorData },
        success: false,
      });

      return NextResponse.json(
        { error: 'Failed to fetch calendar events' },
        { status: eventsResponse.status }
      );
    }

    const events = await eventsResponse.json();

    // Log successful events fetch
    await auditLogger.logEvent({
      user_id: session.user.id,
      action: 'list',
      resource_type: 'google_calendar_events',
      details: { count: events.items?.length || 0 },
      success: true,
    });

    return NextResponse.json(events);
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);

    // Handle specific errors
    if (error.message === 'Calendar not connected') {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}

// POST handler for creating events
export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client (no args)
    const supabase = createServerActionClient();

    // Get user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse the request body
    const eventData = await request.json();

    // Validate required fields
    if (!eventData.summary || !eventData.start || !eventData.end) {
      return NextResponse.json(
        { error: 'Missing required fields (summary, start, end)' },
        { status: 400 }
      );
    }

    // Get access token (refreshed if needed)
    const accessToken = await getValidToken(supabase, session.user.id);

    // Create event in Google Calendar
    const createResponse = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(eventData),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error('Google Calendar API error:', errorData);

      await auditLogger.logEvent({
        user_id: session.user.id,
        action: 'create',
        resource_type: 'google_calendar_event',
        details: { error: errorData },
        success: false,
      });

      return NextResponse.json(
        { error: 'Failed to create calendar event' },
        { status: createResponse.status }
      );
    }

    const createdEvent = await createResponse.json();

    // Log successful event creation
    await auditLogger.logEvent({
      user_id: session.user.id,
      action: 'create',
      resource_type: 'google_calendar_event',
      details: { eventId: createdEvent.id },
      success: true,
    });

    return NextResponse.json(createdEvent);
  } catch (error: any) {
    console.error('Error creating calendar event:', error);

    // Handle specific errors
    if (error.message === 'Calendar not connected') {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
  }
}
