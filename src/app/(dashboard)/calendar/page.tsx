'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, LogOut, Plus } from 'lucide-react';
import { useGoogleCalendar, CalendarEvent, NewCalendarEvent } from '@/lib/hooks/useCalendar';

// Helper function to format event times (moved to top for clarity)
function formatEventTime(
  startDateTime: string | null | undefined,
  endDateTime: string | null | undefined
): string {
  if (!startDateTime || !endDateTime) return 'Time not specified';

  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);

  // Check for invalid dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return 'Invalid date format';
  }

  const sameDay = startDate.toDateString() === endDate.toDateString();
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

  if (sameDay) {
    // Handle cases where only date is provided (no time)
    if (startDateTime.length <= 10) {
      // YYYY-MM-DD
      return (
        startDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) + ' (All day)'
      );
    }
    return `${startDate.toLocaleDateString()} · ${startDate.toLocaleTimeString(
      [],
      options
    )} - ${endDate.toLocaleTimeString([], options)}`;
  } else {
    // Handle cases where only date is provided (no time)
    if (startDateTime.length <= 10 && endDateTime.length <= 10) {
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    }
    return `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString(
      [],
      options
    )} - ${endDate.toLocaleDateString()} ${endDate.toLocaleTimeString([], options)}`;
  }
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New event form state
  const [newEvent, setNewEvent] = useState<NewCalendarEvent>({
    summary: '',
    description: '',
    location: '',
    start: {
      // Default to ISO string format expected by datetime-local input
      dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16), // Default to 1 hour from now
    },
    end: {
      dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16), // Default to 2 hours from now
    },
  });

  // Initialize Google API client - REMOVED PLACEHOLDER CREDENTIALS
  // Credentials should be handled securely, e.g., via environment variables and server-side logic.
  // const oauth2Client = new google.auth.OAuth2(
  //   process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  //   process.env.GOOGLE_CLIENT_SECRET, // Keep secret server-side
  //   process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
  // );

  // Assuming useGoogleCalendar hook handles authentication and provides these
  const {
    isConnected,
    isLoading: googleIsLoading,
    // events: googleEvents, // Renamed to avoid conflict if needed, or remove if loadEvents uses getEvents directly
    connect,
    getEvents,
    createEvent: createGoogleEvent, // Renamed to be specific
    disconnect,
  } = useGoogleCalendar(); // Assuming this hook handles auth and API client setup

  // Fetch events from Google Calendar using the hook
  const loadEvents = useCallback(async () => {
    if (isConnected) {
      setIsLoading(true);
      try {
        const events = await getEvents(); // Assuming getEvents returns CalendarEvent[]
        // Ensure the mapping is correct and handles potential null/undefined values safely
        setAllEvents(
          events.map((event: CalendarEvent) => ({
            ...event, // Spread existing properties
            id: event.id || `temp-${Math.random()}`, // Provide a fallback ID if missing
            summary: event.summary || 'No Title',
            description: event.description || '',
            location: event.location || '',
            start: {
              dateTime: event.start?.dateTime || '', // Use only dateTime, formatEventTime handles date-only cases
              timeZone: event.start?.timeZone, // Keep timezone if available
            },
            end: {
              dateTime: event.end?.dateTime || '', // Use only dateTime
              timeZone: event.end?.timeZone, // Keep timezone if available
            },
            provider: 'google', // Explicitly set provider
          }))
        );
      } catch (error) {
        console.error('Error loading Google Calendar events:', error);
        toast({
          title: 'Error Loading Events',
          description: 'Could not fetch events from Google Calendar.',
          variant: 'destructive',
        });
        setAllEvents([]); // Clear events on error
      } finally {
        setIsLoading(false);
      }
    } else {
      setAllEvents([]); // Clear events if not connected
      setIsLoading(false); // Ensure loading stops if not connected initially
    }
  }, [isConnected, getEvents, toast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]); // Dependency array is correct

  // Create a new event in Google Calendar using the hook
  const handleCreateEvent = async () => {
    if (!isConnected || !createGoogleEvent) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to Google Calendar first.',
        variant: 'destructive',
      });
      return;
    }

    // Basic validation
    if (!newEvent.summary || !newEvent.start.dateTime || !newEvent.end.dateTime) {
      toast({
        title: 'Missing Information',
        description: 'Please provide event title, start time, and end time.',
        variant: 'destructive',
      });
      return;
    }

    // Convert local datetime string back to Date objects if needed by the hook,
    // or ensure the hook expects ISO strings. Assuming hook handles it.
    const eventToCreate: NewCalendarEvent = {
      ...newEvent,
      // Ensure start and end are in the format expected by the hook/API
      // Google API typically expects dateTime in ISO format with timezone offset
      // or just date for all-day events.
      start: {
        dateTime: new Date(newEvent.start.dateTime).toISOString(), // Convert to full ISO string
        // timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Optional: Add user's timezone
      },
      end: {
        dateTime: new Date(newEvent.end.dateTime).toISOString(), // Convert to full ISO string
        // timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Optional: Add user's timezone
      },
    };

    try {
      await createGoogleEvent(eventToCreate);

      toast({
        title: 'Event Created',
        description: 'Your event has been added to Google Calendar.',
        variant: 'success', // Use 'success' variant if available, else default
      });

      // Reset form and reload events
      setNewEvent({
        summary: '',
        description: '',
        location: '',
        start: {
          dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
        },
        end: {
          dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
        },
      });
      await loadEvents(); // Use loadEvents to refresh
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      toast({
        title: 'Error Creating Event',
        description: 'Failed to create the event in Google Calendar.',
        variant: 'destructive',
      });
    }
  };

  // Removed AppleConnectForm

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Calendar Integration</h1>

      {/* Calendar Providers - Only Google */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {/* Google Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {/* Placeholder for Google Logo if lucide-react doesn't have it */}
              {/* <GoogleLogo className="h-5 w-5 mr-2" /> */}
              <span className="h-5 w-5 mr-2">G</span> {/* Simple text placeholder */}
              Google Calendar
            </CardTitle>
            <CardDescription>Sync your Google Calendar events</CardDescription>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <div className="text-green-600 font-medium flex items-center">
                <div className="h-2 w-2 rounded-full bg-green-600 mr-2"></div>
                Connected
              </div>
            ) : (
              <div className="text-gray-500">Not connected</div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            {isConnected ? (
              <Button variant="outline" onClick={disconnect} disabled={googleIsLoading}>
                {googleIsLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button onClick={connect} disabled={googleIsLoading}>
                {googleIsLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  // Placeholder for Google Logo
                  <span className="h-4 w-4 mr-2">G</span> /* Simple text placeholder */
                )}
                Connect Google
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Removed Apple Calendar Card */}
      </div>

      {/* Calendar Management */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Events List */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Upcoming Google Events</CardTitle>
                <CardDescription>View and manage your upcoming events</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={loadEvents}
                disabled={isLoading || !isConnected}
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2">Loading events...</span>
                </div>
              ) : !isConnected ? (
                <div className="text-center py-8 text-gray-500">
                  Please connect to Google Calendar to view events.
                </div>
              ) : allEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No upcoming events found in your Google Calendar.
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {' '}
                  {/* Added scroll */}
                  {allEvents.map(event => (
                    <div key={event.id} className="border rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{event.summary}</h3>
                          {event.location && (
                            <p className="text-sm text-gray-500 mt-1">Location: {event.location}</p>
                          )}
                        </div>
                        {/* Provider indicator (optional since it's only Google now) */}
                        <div className="flex items-center text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {/* Placeholder for Google Logo */}
                          <span className="h-3 w-3 mr-1 font-bold">G</span>
                          Google
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        {/* Use the updated formatEventTime function */}
                        {formatEventTime(event.start?.dateTime, event.end?.dateTime)}
                        {event.start?.timeZone && ` (${event.start.timeZone})`}
                      </div>
                      {event.description && (
                        <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                          {' '}
                          {/* Preserve whitespace */}
                          {event.description}
                        </p>
                      )}
                      {/* Add link to Google Calendar event */}
                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                        >
                          View on Google Calendar
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create Event Form - Simplified for Google */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Add New Google Event</CardTitle>
              <CardDescription>Create a new event in your Google Calendar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Removed Tabs */}
              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  value={newEvent.summary}
                  onChange={e => setNewEvent({ ...newEvent, summary: e.target.value })}
                  placeholder="Meeting with client"
                  disabled={!isConnected || googleIsLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Time</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={newEvent.start.dateTime}
                    onChange={e =>
                      setNewEvent({
                        ...newEvent,
                        start: { dateTime: e.target.value },
                      })
                    }
                    disabled={!isConnected || googleIsLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Time</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={newEvent.end.dateTime}
                    onChange={e =>
                      setNewEvent({
                        ...newEvent,
                        end: { dateTime: e.target.value },
                      })
                    }
                    disabled={!isConnected || googleIsLoading}
                    min={newEvent.start.dateTime} // Prevent end time before start time
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newEvent.location || ''}
                  onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Office, address, or video call link"
                  disabled={!isConnected || googleIsLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description / Notes</Label>
                <Textarea
                  id="description"
                  value={newEvent.description || ''}
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Meeting agenda, details, etc."
                  rows={4} // Increased rows
                  disabled={!isConnected || googleIsLoading}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleCreateEvent}
                disabled={
                  !isConnected ||
                  googleIsLoading ||
                  !newEvent.summary ||
                  !newEvent.start.dateTime ||
                  !newEvent.end.dateTime
                }
                className="w-full"
              >
                {googleIsLoading ? ( // Use googleIsLoading consistently
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add to Google Calendar
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Removed the previous formatEventTime function from the bottom
