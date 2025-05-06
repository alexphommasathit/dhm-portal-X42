/**
 * Helper functions for Google OAuth token management
 */

// Google OAuth2 configuration
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

/**
 * Refresh a Google OAuth access token
 * 
 * @param refreshToken - The refresh token to use
 * @returns New access token and expiration
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: string;
  token_type: string;
}> {
  try {
    // Exchange refresh token for a new access token
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to refresh token: ${JSON.stringify(errorData)}`);
    }

    const tokenData = await response.json();
    
    // Calculate token expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    return {
      access_token: tokenData.access_token,
      expires_at: expiresAt.toISOString(),
      token_type: tokenData.token_type,
    };
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    throw error;
  }
} 