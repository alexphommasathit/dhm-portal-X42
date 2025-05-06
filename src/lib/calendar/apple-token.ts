/**
 * Helper functions for Apple calendar token management
 */

import jwt from 'jsonwebtoken';

// Apple API configuration
const APPLE_APP_ID = process.env.APPLE_APP_ID!;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID!;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID!;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY!;
const APPLE_PRIVATE_KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH;

// Function to get the private key from env or file
function getPrivateKey() {
  if (APPLE_PRIVATE_KEY) {
    // Decode if it's base64 encoded
    if (APPLE_PRIVATE_KEY.includes("-----BEGIN PRIVATE KEY-----")) {
      return APPLE_PRIVATE_KEY;
    } else {
      return Buffer.from(APPLE_PRIVATE_KEY, 'base64').toString('utf-8');
    }
  } else if (APPLE_PRIVATE_KEY_PATH) {
    // Read from file
    const fs = require('fs');
    return fs.readFileSync(APPLE_PRIVATE_KEY_PATH, 'utf8');
  } else {
    throw new Error('Apple private key not configured');
  }
}

/**
 * Refresh an Apple calendar token
 * 
 * @param refreshTokenData - JSON string with appleId and password
 * @returns New access token and expiration
 */
export async function refreshAppleToken(refreshTokenData: string): Promise<{
  access_token: string;
  expires_at: string;
}> {
  try {
    // Parse the stored credentials
    const credentials = JSON.parse(refreshTokenData);
    
    // Generate a new client token for iCloud services
    const privateKey = getPrivateKey();
    
    // Generate new JWT token for authentication
    const token = jwt.sign({
      iss: APPLE_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      aud: 'https://appleid.apple.com',
      sub: APPLE_APP_ID,
    }, privateKey, {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: APPLE_KEY_ID
      }
    });
    
    // Calculate token expiration (1 day for this example)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    
    return {
      access_token: token,
      expires_at: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('Error refreshing Apple token:', error);
    throw error;
  }
} 