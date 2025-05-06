# Environment Variable Setup for Calendar Integration

To enable the calendar integration features, you'll need to set up the following environment variables in your `.env.local` file:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Application URL
NEXT_PUBLIC_URL=http://localhost:3000

# Google Calendar API
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Apple Calendar (iCloud) Integration
APPLE_APP_ID=your-apple-app-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-base64-encoded-private-key
# If your key is in a file, use this instead and comment out the above
# APPLE_PRIVATE_KEY_PATH=./private/AuthKey_KEYID.p8
```

## Setup Instructions

### Google Calendar API Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Dashboard" and click "Enable APIs and Services"
4. Search for and enable the "Google Calendar API"
5. Go to "APIs & Services" > "Credentials"
6. Click "Create Credentials" and select "OAuth client ID"
7. Configure the OAuth consent screen if prompted
8. For Application type, select "Web application"
9. Add authorized redirect URIs:
   - `http://localhost:3000/api/calendar/google/callback` (for development)
   - `https://yourdomain.com/api/calendar/google/callback` (for production)
10. Copy the Client ID and Client Secret to your `.env.local` file

### Apple Calendar Setup

1. Register for an [Apple Developer Account](https://developer.apple.com/)
2. Go to "Certificates, Identifiers & Profiles"
3. Create a new App ID with the appropriate capabilities
4. Generate a new private key from the "Keys" section
5. Note down the:
   - App ID
   - Team ID (visible in the top right of the developer console)
   - Key ID
6. Download the private key file
7. You can either:
   - Base64 encode the private key file contents and set as `APPLE_PRIVATE_KEY`
   - Store the key file securely and reference the path as `APPLE_PRIVATE_KEY_PATH`

## Validation

After setting up the environment variables, you can run:

```bash
npm run validate:env
```

This will check that all required variables are set correctly. 