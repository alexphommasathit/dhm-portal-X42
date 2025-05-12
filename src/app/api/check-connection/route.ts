import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Create a service client
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.PRIVATE_SUPABASE_SERVICE_KEY || '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Get environment variables
    const envInfo = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: Boolean(process.env.PRIVATE_SUPABASE_SERVICE_KEY),
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    };

    // Check database directly
    const { data: tableCheck, error: tableError } = await serviceClient
      .from('patients')
      .select('count(*)', { count: 'exact' });

    // Check auth connection
    const { data: functionCheck, error: functionError } = await serviceClient.rpc(
      'get_all_patients',
      { limit_count: 1 }
    );

    // Check supabase auth
    const { data: userCheck, error: userError } = await serviceClient.auth.admin.listUsers({
      perPage: 1,
    });

    // Return all diagnostic information
    return NextResponse.json({
      success: true,
      environment: envInfo,
      connections: {
        tableCheck: tableCheck || null,
        tableError: tableError || null,
        functionCheck: functionCheck || null,
        functionError: functionError || null,
        userCheck: userCheck || null,
        userError: userError || null,
      },
    });
  } catch (error) {
    console.error('Unhandled error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
