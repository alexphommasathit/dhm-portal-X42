import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    localUrl: 'http://127.0.0.1:54321',
    possibleIssue:
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321'
        ? 'The URL may not be pointing to your local Supabase instance'
        : 'URL seems correct for local development',
    hasServiceKey: Boolean(process.env.PRIVATE_SUPABASE_SERVICE_KEY),
    serviceKeyLength: process.env.PRIVATE_SUPABASE_SERVICE_KEY?.length || 0,
    anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
  });
}
