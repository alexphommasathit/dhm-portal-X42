import { createClientComponentSupabase } from '@/lib/supabase/client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';

// Event interface shared by both calendar providers
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  creator?: {
    email?: string;
    displayName?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  [key: string]: any;
}

// New event data type
export interface NewCalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
  }>;
}

// Base hook for shared calendar functionality
function useCalendarBase() {
  const supabase = createClientComponentSupabase();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check if the calendar is connected
  const checkConnection = useCallback(
    async (provider: 'google' | 'apple') => {
      try {
        setIsLoading(true);

        const { data, error } = await supabase
          .from('calendar_tokens')
          .select('id')
          .eq('provider', provider)
          .maybeSingle();

        if (error) throw error;

        setIsConnected(!!data);
        return !!data;
      } catch (err) {
        console.error(`Error checking ${provider} calendar connection:`, err);
        setError(`Failed to check calendar connection`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  return {
    supabase,
    toast,
    isConnected,
    setIsConnected,
    isLoading,
    setIsLoading,
    events,
    setEvents,
    error,
    setError,
    checkConnection,
  };
}

// Google Calendar Hook
export function useGoogleCalendar() {
  const base = useCalendarBase();
  const {
    supabase,
    toast,
    isConnected,
    setIsConnected,
    isLoading,
    setIsLoading,
    events,
    setEvents,
    error,
    setError,
    checkConnection,
  } = base;

  // Initialize and check connection status
  useEffect(() => {
    checkConnection('google').then(connected => {
      setIsConnected(connected);
      setIsLoading(false);
    });
  }, [checkConnection, setIsConnected, setIsLoading]);

  // Connect Google Calendar
  const connect = useCallback(async () => {
    try {
      setIsLoading(true);

      // Redirect to the connect endpoint
      window.location.href = '/api/calendar/google/connect';

      // Note: The user will be redirected to Google's auth page,
      // and then back to our callback URL
    } catch (err) {
      console.error('Error connecting Google Calendar:', err);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to Google Calendar',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [toast, setIsLoading]);

  // Fetch events from Google Calendar
  const getEvents = useCallback(
    async (timeMin?: string, timeMax?: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const isValid = await checkConnection('google');
        if (!isValid) {
          setError('Google Calendar not connected');
          return [];
        }

        // Build query params
        const params = new URLSearchParams();
        if (timeMin) params.append('timeMin', timeMin);
        if (timeMax) params.append('timeMax', timeMax);

        // Fetch events from API
        const response = await fetch(`/api/calendar/google/events?${params.toString()}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch events');
        }

        const data = await response.json();
        setEvents(data.items || []);
        return data.items || [];
      } catch (err) {
        console.error('Error fetching Google Calendar events:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch events');
        setEvents([]);

        toast({
          title: 'Calendar Error',
          description: err instanceof Error ? err.message : 'Failed to fetch calendar events',
          variant: 'destructive',
        });

        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [checkConnection, setIsLoading, setError, setEvents, toast]
  );

  // Create a new event in Google Calendar
  const createEvent = useCallback(
    async (eventData: NewCalendarEvent) => {
      try {
        setIsLoading(true);
        setError(null);

        const isValid = await checkConnection('google');
        if (!isValid) {
          setError('Google Calendar not connected');
          throw new Error('Google Calendar not connected');
        }

        // Create event via API
        const response = await fetch('/api/calendar/google/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create event');
        }

        const createdEvent = await response.json();

        // Update events list with the new event
        setEvents(prev => [...prev, createdEvent]);

        toast({
          title: 'Event Created',
          description: `"${eventData.summary}" added to Google Calendar`,
        });

        return createdEvent;
      } catch (err) {
        console.error('Error creating Google Calendar event:', err);
        setError(err instanceof Error ? err.message : 'Failed to create event');

        toast({
          title: 'Calendar Error',
          description: err instanceof Error ? err.message : 'Failed to create event',
          variant: 'destructive',
        });

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [checkConnection, setIsLoading, setError, setEvents, toast]
  );

  // Disconnect Google Calendar (remove token)
  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);

      const { error } = await supabase.from('calendar_tokens').delete().eq('provider', 'google');

      if (error) throw error;

      setIsConnected(false);
      setEvents([]);

      toast({
        title: 'Disconnected',
        description: 'Google Calendar has been disconnected',
      });
    } catch (err) {
      console.error('Error disconnecting Google Calendar:', err);
      toast({
        title: 'Error',
        description: 'Failed to disconnect Google Calendar',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, setIsLoading, setIsConnected, setEvents, toast]);

  return {
    isConnected,
    isLoading,
    events,
    error,
    connect,
    getEvents,
    createEvent,
    disconnect,
  };
}
