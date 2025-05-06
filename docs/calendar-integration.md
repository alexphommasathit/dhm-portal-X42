# Calendar Integration for DHM Portal

## Overview

The calendar integration feature allows users to connect to and interact with their Google and Apple calendars directly from the DHM Portal. This integration enables users to:

- Connect their Google Calendar via OAuth 2.0
- Connect their Apple Calendar via CalDAV
- View upcoming events from all connected calendars
- Create new events in any connected calendar

## Architecture

The integration is built with the following components:

1. **Database**: The `calendar_tokens` table stores connection tokens securely
2. **Backend API Routes**: Handles authentication, token management, and calendar operations
3. **Client Hooks**: Provides React hooks for components to interact with calendars
4. **UI Components**: User-friendly interface for calendar management

## Technical Implementation

### Database

We've created a migration for a `calendar_tokens` table with the following structure:

- `id` (UUID): Primary key
- `provider` (TEXT): 'google' or 'apple'
- `access_token` (TEXT): Current access token
- `refresh_token` (TEXT): Refresh token (or encrypted credentials for Apple)
- `expires_at` (TIMESTAMP): Token expiration time
- `user_id` (UUID): Foreign key to profiles.id
- `created_at`, `updated_at` (TIMESTAMP): Timestamps

### API Routes

The API routes are organized as follows:

#### Google Calendar
- `/api/calendar/google/connect`: Initiates OAuth flow
- `/api/calendar/google/callback`: Handles OAuth callback
- `/api/calendar/google/events`: Lists and creates events

#### Apple Calendar
- `/api/calendar/apple/connect`: Creates connection with Apple ID/password
- `/api/calendar/apple/events`: Lists and creates events

### Token Management

Both providers require different token handling approaches:

- **Google**: Uses OAuth 2.0 with authorization code flow, including refresh tokens
- **Apple**: Uses a combination of JWT tokens and stored credentials for CalDAV

### Client Hooks

We've implemented several React hooks for easy integration:

- `useGoogleCalendar()`: Manages Google Calendar connections and operations
- `useAppleCalendar()`: Manages Apple Calendar connections and operations
- `useCalendars()`: Combines both providers for unified calendar access

These hooks provide a consistent interface with methods like:
- `connect()`: Connect to the calendar service
- `getEvents()`: Retrieve events
- `createEvent()`: Create a new event
- `disconnect()`: Remove the calendar connection

### UI Components

The calendar UI includes:

- Connection cards for Google and Apple calendars
- Event listing with provider indicators
- New event creation form with calendar selection

## Security Considerations

1. **Token Storage**: All tokens are stored securely in the database with RLS policies
2. **CSRF Protection**: The Google OAuth flow includes state validation
3. **Credential Handling**: Apple credentials are base64 encoded (should be properly encrypted in production)
4. **Access Control**: Row-level security ensures users can only access their own tokens

## Installation & Dependencies

See [calendar-dependencies.md](./calendar-dependencies.md) for a complete list of dependencies and installation instructions.

## Future Improvements

- Implement proper encryption for Apple credentials
- Add event editing and deletion capabilities
- Support for recurrent events
- Calendar sharing with team members
- Multi-calendar support for each provider
- Notification integration

## Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [Apple CalDAV Documentation](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/index.html) 